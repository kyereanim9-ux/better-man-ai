import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db, DOMAINS } from '../../db.js';

const router = Router();
router.use(requireAuth);

const CATEGORIES = DOMAINS;

router.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.goals.filter(g => g.userId === req.user.id));
});

router.post('/', async (req, res) => {
  const { title, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis.' });
  await db.read();
  const goal = {
    id: nanoid(), userId: req.user.id, title,
    category: CATEGORIES.includes(category) ? category : 'mental',
    status: 'active', createdAt: new Date().toISOString()
  };
  db.data.goals.push(goal);
  await db.write();
  res.status(201).json(goal);
});

router.patch('/:id', async (req, res) => {
  const { status } = req.body; // 'active' | 'done' | 'paused'
  await db.read();
  const goal = db.data.goals.find(g => g.id === req.params.id && g.userId === req.user.id);
  if (!goal) return res.status(404).json({ error: 'Objectif introuvable.' });
  if (status) {
    goal.status = status;
    if (status === 'done') goal.completedAt = new Date().toISOString();
  }
  await db.write();
  res.json(goal);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.goals.length;
  db.data.goals = db.data.goals.filter(g => !(g.id === req.params.id && g.userId === req.user.id));
  if (db.data.goals.length === before) return res.status(404).json({ error: 'Objectif introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
