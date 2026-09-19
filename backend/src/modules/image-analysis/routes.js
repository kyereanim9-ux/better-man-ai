import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { routeImageChat, getProviderStatus } from '../../ai/aiRouter.js';
import { buildSystemPrompt, CATEGORY_LABELS } from '../../ai/prompts.js';

const router = Router();
router.use(requireAuth);

router.get('/categories', (req, res) => res.json(CATEGORY_LABELS));

// Panneau admin léger : statut des fournisseurs (configuré ou non, requêtes
// et erreurs depuis le démarrage du serveur, dernière utilisation).
router.get('/status', requireAdmin, (req, res) => res.json(getProviderStatus()));

router.get('/', async (req, res) => {
  await db.read();
  const list = db.data.imageAnalyses
    .filter(a => a.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(a => ({
      id: a.id, category: a.category, photo: a.photo,
      title: a.messages[0]?.content.slice(0, 60) || CATEGORY_LABELS[a.category],
      lastMessage: a.messages[a.messages.length - 1]?.content.slice(0, 80),
      messageCount: a.messages.length, createdAt: a.createdAt
    }));
  res.json(list);
});

router.get('/:id', async (req, res) => {
  await db.read();
  const analysis = db.data.imageAnalyses.find(a => a.id === req.params.id && a.userId === req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analyse introuvable.' });
  res.json(analysis);
});

router.post('/', async (req, res) => {
  const { photo, category, question, keepPhoto } = req.body;
  if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Format de photo invalide.' });
  }
  if (photo.length > 1200000) return res.status(400).json({ error: 'Photo trop volumineuse.' });
  const cat = CATEGORY_LABELS[category] ? category : 'auto';
  const firstQuestion = question?.trim() || 'Analyse cette photo.';

  const systemPrompt = buildSystemPrompt(cat);
  const result = await routeImageChat({
    systemPrompt,
    messages: [{ role: 'user', content: firstQuestion }],
    imageDataUrl: photo
  });

  await db.read();
  const analysis = {
    id: nanoid(), userId: req.user.id, category: cat,
    photo: keepPhoto === false ? null : photo,
    messages: [
      { role: 'user', content: firstQuestion, createdAt: new Date().toISOString() },
      { role: 'assistant', content: result.ok ? result.reply : result.note, createdAt: new Date().toISOString() }
    ],
    providerUsed: result.ok ? result.providerUsed : null,
    modelUsed: result.ok ? result.modelUsed : null,
    createdAt: new Date().toISOString()
  };
  db.data.imageAnalyses.push(analysis);
  await db.write();
  res.status(201).json({ ...analysis, unavailable: !result.ok });
});

router.post('/:id/messages', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message vide.' });
  await db.read();
  const analysis = db.data.imageAnalyses.find(a => a.id === req.params.id && a.userId === req.user.id);
  if (!analysis) return res.status(404).json({ error: 'Analyse introuvable.' });

  analysis.messages.push({ role: 'user', content, createdAt: new Date().toISOString() });

  const systemPrompt = buildSystemPrompt(analysis.category);
  const result = await routeImageChat({
    systemPrompt,
    messages: analysis.messages.map(m => ({ role: m.role, content: m.content })),
    imageDataUrl: analysis.photo
  });

  const assistantMsg = { role: 'assistant', content: result.ok ? result.reply : result.note, createdAt: new Date().toISOString() };
  analysis.messages.push(assistantMsg);
  if (result.ok) { analysis.providerUsed = result.providerUsed; analysis.modelUsed = result.modelUsed; }

  await db.write();
  res.json({ ...analysis, unavailable: !result.ok });
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.imageAnalyses.length;
  db.data.imageAnalyses = db.data.imageAnalyses.filter(a => !(a.id === req.params.id && a.userId === req.user.id));
  if (db.data.imageAnalyses.length === before) return res.status(404).json({ error: 'Analyse introuvable.' });
  await db.write();
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await db.read();
  db.data.imageAnalyses = db.data.imageAnalyses.filter(a => a.userId !== req.user.id);
  await db.write();
  res.json({ ok: true });
});

export default router;
