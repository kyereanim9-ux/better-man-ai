import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { getCoachReply } from '../coach/aiProvider.js';
import { routeImageChat } from '../../ai/aiRouter.js';
import { buildSystemPrompt } from '../../ai/prompts.js';
import { chatWithFallback, getTextProviderStatus } from '../../ai/textChatRouter.js';

const router = Router();
router.use(requireAuth);

const COACH_SYSTEM_PROMPT =
  "Tu es Better Man Coach, un coach personnel bienveillant et réfléchi. Aide l'utilisateur à réfléchir avant d'agir : pose des questions, reste concret, ne décide jamais à sa place et ne donne pas d'ordre. Reste bref (quelques phrases), réponds en français, avec empathie mais sans complaisance excessive.";

// Statut des fournisseurs de texte (admin) — même esprit que /image-analysis/status.
router.get('/text-provider-status', requireAdmin, (req, res) => res.json(getTextProviderStatus()));

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
  const { content, photo, lang } = req.body;
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
  let source = 'local';
  if (photo) {
    const result = await routeImageChat({
      systemPrompt: buildSystemPrompt('coach'),
      messages: [{ role: 'user', content: content || 'Regarde cette photo et aide-moi à réfléchir à ce qu\'elle représente.' }],
      imageDataUrl: photo
    });
    reply = result.ok ? result.reply : result.note;
    source = result.ok ? result.providerUsed : 'local';
  } else {
    // Vrai LLM en priorité si au moins un fournisseur est configuré ;
    // repli automatique sur le coach local (réflexif, à base de règles,
    // 0 €) si aucune clé n'est renseignée ou si tous les fournisseurs échouent.
    // "source" est renvoyée au frontend pour que ce soit VÉRIFIABLE, pas
    // juste affirmé — sans ça, la bascule est invisible côté utilisateur.
    try {
      const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      const langInstruction = lang && lang !== 'français' ? ` Réponds en ${lang}, pas en français.` : '';
      const result = await chatWithFallback([{ role: 'system', content: COACH_SYSTEM_PROMPT + langInstruction }, ...history]);
      reply = result.content;
      source = result.providerUsed;
    } catch {
      reply = await getCoachReply(conv.messages, { userId: req.user.id });
      source = 'local';
    }
  }
  const assistantMsg = { role: 'assistant', content: reply, source, createdAt: new Date().toISOString() };
  conv.messages.push(assistantMsg);

  await db.write();
  res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

export default router;
