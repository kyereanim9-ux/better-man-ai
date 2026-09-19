import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

const ENTRY_TYPES = ['sujet', 'conflit', 'positif', 'besoin'];
const ENTRY_TYPE_LABELS = { sujet: 'Sujet important', conflit: 'Conflit', positif: 'Moment positif', besoin: 'Besoin exprimé' };

router.get('/', async (req, res) => {
  await db.read();
  const list = db.data.relationships
    .filter(r => r.userId === req.user.id)
    .map(r => {
      const entries = db.data.relationshipEntries.filter(e => e.relationshipId === r.id);
      return { ...r, entryCount: entries.length, lastEntryAt: entries.length ? entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt : null };
    });
  res.json(list);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  await db.read();
  const relationship = { id: nanoid(), userId: req.user.id, name, createdAt: new Date().toISOString() };
  db.data.relationships.push(relationship);
  await db.write();
  res.status(201).json(relationship);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.relationships.length;
  db.data.relationships = db.data.relationships.filter(r => !(r.id === req.params.id && r.userId === req.user.id));
  db.data.relationshipEntries = db.data.relationshipEntries.filter(e => !(e.relationshipId === req.params.id && e.userId === req.user.id));
  if (db.data.relationships.length === before) return res.status(404).json({ error: 'Relation introuvable.' });
  await db.write();
  res.json({ ok: true });
});

router.get('/:id/entries', async (req, res) => {
  await db.read();
  const relationship = db.data.relationships.find(r => r.id === req.params.id && r.userId === req.user.id);
  if (!relationship) return res.status(404).json({ error: 'Relation introuvable.' });
  const entries = db.data.relationshipEntries
    .filter(e => e.relationshipId === req.params.id && e.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ relationship, entries, entryTypeLabels: ENTRY_TYPE_LABELS });
});

router.post('/:id/entries', async (req, res) => {
  const { type, content, whatYouKnow, whatYouAssume, toAsk } = req.body;
  if (!ENTRY_TYPES.includes(type)) return res.status(400).json({ error: `type doit être l'un de : ${ENTRY_TYPES.join(', ')}.` });
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu vide.' });
  await db.read();
  const relationship = db.data.relationships.find(r => r.id === req.params.id && r.userId === req.user.id);
  if (!relationship) return res.status(404).json({ error: 'Relation introuvable.' });

  const entry = {
    id: nanoid(), userId: req.user.id, relationshipId: req.params.id, type, content,
    whatYouKnow: whatYouKnow || '', whatYouAssume: whatYouAssume || '', toAsk: toAsk || '',
    createdAt: new Date().toISOString()
  };
  db.data.relationshipEntries.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/:id/entries/:entryId', async (req, res) => {
  await db.read();
  const before = db.data.relationshipEntries.length;
  db.data.relationshipEntries = db.data.relationshipEntries.filter(
    e => !(e.id === req.params.entryId && e.relationshipId === req.params.id && e.userId === req.user.id)
  );
  if (db.data.relationshipEntries.length === before) return res.status(404).json({ error: 'Entrée introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
