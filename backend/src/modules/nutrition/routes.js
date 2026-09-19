import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

const MEAL_TYPES = ['petit-dejeuner', 'dejeuner', 'diner', 'collation'];

router.get('/meals', async (req, res) => {
  await db.read();
  const list = db.data.mealLogs
    .filter(m => m.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

router.post('/meals', async (req, res) => {
  const { photo, description, mealType, date } = req.body;
  if (!description?.trim() && !photo) return res.status(400).json({ error: 'Ajoute au moins une photo ou une description.' });
  if (photo) {
    if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Format de photo invalide.' });
    }
    if (photo.length > 900000) return res.status(400).json({ error: 'Photo trop volumineuse.' });
  }
  if (mealType && !MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType doit être l'un de : ${MEAL_TYPES.join(', ')}.` });
  }
  await db.read();
  const entry = {
    id: nanoid(), userId: req.user.id, photo: photo || null, description: description || '',
    mealType: mealType || 'collation', date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
  };
  db.data.mealLogs.push(entry);
  await db.write();
  res.status(201).json({
    ...entry,
    note: "Journal manuel : l'app ne reconnaît pas automatiquement le contenu d'une photo (pas d'IA de vision connectée gratuitement). Décris ce que tu manges toi-même."
  });
});

router.delete('/meals/:id', async (req, res) => {
  await db.read();
  const before = db.data.mealLogs.length;
  db.data.mealLogs = db.data.mealLogs.filter(m => !(m.id === req.params.id && m.userId === req.user.id));
  if (db.data.mealLogs.length === before) return res.status(404).json({ error: 'Repas introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
