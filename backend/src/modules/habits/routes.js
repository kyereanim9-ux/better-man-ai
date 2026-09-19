import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.habits.filter(h => h.userId === req.user.id));
});

router.post('/', async (req, res) => {
  const { title, frequency, domain } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis.' });
  await db.read();
  const habit = {
    id: nanoid(), userId: req.user.id, title,
    frequency: frequency || 'daily', domain: domain || 'discipline',
    doneDates: [], createdAt: new Date().toISOString()
  };
  db.data.habits.push(habit);
  await db.write();
  res.status(201).json(habit);
});

// Marque l'habitude comme faite pour aujourd'hui (idempotent).
router.post('/:id/done', async (req, res) => {
  await db.read();
  const habit = db.data.habits.find(h => h.id === req.params.id && h.userId === req.user.id);
  if (!habit) return res.status(404).json({ error: 'Habitude introuvable.' });
  const today = new Date().toISOString().slice(0, 10);
  if (!habit.doneDates.includes(today)) habit.doneDates.push(today);
  await db.write();
  res.json(habit);
});

router.patch('/:id', async (req, res) => {
  const { domain, title } = req.body;
  await db.read();
  const habit = db.data.habits.find(h => h.id === req.params.id && h.userId === req.user.id);
  if (!habit) return res.status(404).json({ error: 'Habitude introuvable.' });
  if (domain) habit.domain = domain;
  if (title?.trim()) habit.title = title;
  await db.write();
  res.json(habit);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.habits.length;
  db.data.habits = db.data.habits.filter(h => !(h.id === req.params.id && h.userId === req.user.id));
  if (db.data.habits.length === before) return res.status(404).json({ error: 'Habitude introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
