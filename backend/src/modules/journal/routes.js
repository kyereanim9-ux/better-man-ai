import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  await db.read();
  const entries = db.data.journalEntries
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(entries);
});

router.post('/', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Le contenu du journal est vide.' });
  await db.read();
  const entry = { id: nanoid(), userId: req.user.id, content, createdAt: new Date().toISOString() };
  db.data.journalEntries.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.journalEntries.length;
  db.data.journalEntries = db.data.journalEntries.filter(
    e => !(e.id === req.params.id && e.userId === req.user.id)
  );
  if (db.data.journalEntries.length === before) return res.status(404).json({ error: 'Entrée introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
