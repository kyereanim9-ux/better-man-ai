import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { getCoachReply } from '../coach/aiProvider.js';
import { routeImageChat } from '../../ai/aiRouter.js';
import { buildSystemPrompt } from '../../ai/prompts.js';

const router = Router();
router.use(requireAuth);

// Liste des conversations de l'utilisateur connecté UNIQUEMENT.
router.get('/conversations', async (req, res) => {
  await db.read();
  const list = db.data.conversations
    .filter(c => c.userId === req.user.id)
    .map(({ id, title, createdAt, messages }) => ({
      id, title, createdAt, messageCount: messages.length
    }));
  res.json(list);
});

router.post('/conversations', async (req, res) => {
  const { title } = req.body;
  await db.read();
  const conv = {
    id: nanoid(),
    userId: req.user.id,
    title: title || 'Nouvelle conversation',
    createdAt: new Date().toISOString(),
    messages: []
  };
  db.data.conversations.push(conv);
  await db.write();
  res.status(201).json(conv);
});

router.get('/conversations/:id', async (req, res) => {
  await db.read();
  const conv = db.data.conversations.find(c => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  res.json(conv);
});

router.delete('/conversations/:id', async (req, res) => {
  await db.read();
  const before = db.data.conversations.length;
  db.data.conversations = db.data.conversations.filter(
    c => !(c.id === req.params.id && c.userId === req.user.id)
  );
  if (db.data.conversations.length === before) return res.status(404).json({ error: 'Conversation introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// Envoie un message et reçoit la réponse du coach. Si une photo est jointe et
// qu'un fournisseur IA de vision est configuré, la réponse passe par le
// routeur d'image plutôt que le coach local (texte seul) habituel.
router.post('/conversations/:id/messages', async (req, res) => {
  const { content, photo } = req.body;
  if (!content?.trim() && !photo) return res.status(400).json({ error: 'Message vide.' });
  if (photo) {
    if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Format de photo invalide.' });
    }
    if (photo.length > 1200000) return res.status(400).json({ error: 'Photo trop volumineuse.' });
  }

  await db.read();
  const conv = db.data.conversations.find(c => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });

  const userMsg = { role: 'user', content: content || '(photo envoyée)', createdAt: new Date().toISOString(), hasPhoto: !!photo };
  conv.messages.push(userMsg);

  let reply;
  if (photo) {
    const result = await routeImageChat({
      systemPrompt: buildSystemPrompt('coach'),
      messages: [{ role: 'user', content: content || 'Regarde cette photo et aide-moi à réfléchir à ce qu\'elle représente.' }],
      imageDataUrl: photo
    });
    reply = result.ok ? result.reply : result.note;
  } else {
    reply = await getCoachReply(conv.messages, { userId: req.user.id });
  }
  const assistantMsg = { role: 'assistant', content: reply, createdAt: new Date().toISOString() };
  conv.messages.push(assistantMsg);

  await db.write();
  res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

export default router;
