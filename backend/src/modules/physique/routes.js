import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

const MILESTONES = ['30j', '60j', '90j', '6mois', '1an'];

// --- MESURES (poids, tour de taille) ---

router.get('/measurements', async (req, res) => {
  await db.read();
  const list = db.data.physiqueMeasurements
    .filter(m => m.userId === req.user.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  res.json(list);
});

router.post('/measurements', async (req, res) => {
  const { weight, waist, date } = req.body;
  if (!weight && !waist) return res.status(400).json({ error: 'Renseigne au moins le poids ou le tour de taille.' });
  await db.read();
  const entry = {
    id: nanoid(), userId: req.user.id,
    weight: weight ? Number(weight) : null,
    waist: waist ? Number(waist) : null,
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
  };
  db.data.physiqueMeasurements.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/measurements/:id', async (req, res) => {
  await db.read();
  const before = db.data.physiqueMeasurements.length;
  db.data.physiqueMeasurements = db.data.physiqueMeasurements.filter(
    m => !(m.id === req.params.id && m.userId === req.user.id)
  );
  if (db.data.physiqueMeasurements.length === before) return res.status(404).json({ error: 'Mesure introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// --- ENTRAÎNEMENTS ---

router.get('/workouts', async (req, res) => {
  await db.read();
  const list = db.data.physiqueWorkouts
    .filter(w => w.userId === req.user.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json(list);
});

router.post('/workouts', async (req, res) => {
  const { type, durationMinutes, sets, reps, notes, date } = req.body;
  if (!type?.trim()) return res.status(400).json({ error: 'Type d\'entraînement requis (ex: musculation, course, mobilité).' });
  await db.read();
  const workout = {
    id: nanoid(), userId: req.user.id, type,
    durationMinutes: durationMinutes ? Number(durationMinutes) : null,
    sets: sets ? Number(sets) : null,
    reps: reps ? Number(reps) : null,
    notes: notes || '',
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
  };
  db.data.physiqueWorkouts.push(workout);
  await db.write();
  res.status(201).json(workout);
});

router.delete('/workouts/:id', async (req, res) => {
  await db.read();
  const before = db.data.physiqueWorkouts.length;
  db.data.physiqueWorkouts = db.data.physiqueWorkouts.filter(
    w => !(w.id === req.params.id && w.userId === req.user.id)
  );
  if (db.data.physiqueWorkouts.length === before) return res.status(404).json({ error: 'Entraînement introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// --- OBJECTIFS PROGRESSIFS (30j / 60j / 90j / 6 mois / 1 an) ---

router.get('/goals', async (req, res) => {
  await db.read();
  res.json(db.data.physiqueGoals.filter(g => g.userId === req.user.id));
});

router.post('/goals', async (req, res) => {
  const { title, milestone, targetDate } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis.' });
  if (!MILESTONES.includes(milestone)) {
    return res.status(400).json({ error: `milestone doit être l'un de : ${MILESTONES.join(', ')}.` });
  }
  await db.read();
  const goal = {
    id: nanoid(), userId: req.user.id, title, milestone,
    targetDate: targetDate || null, achieved: false, createdAt: new Date().toISOString()
  };
  db.data.physiqueGoals.push(goal);
  await db.write();
  res.status(201).json(goal);
});

router.patch('/goals/:id', async (req, res) => {
  const { achieved } = req.body;
  await db.read();
  const goal = db.data.physiqueGoals.find(g => g.id === req.params.id && g.userId === req.user.id);
  if (!goal) return res.status(404).json({ error: 'Objectif introuvable.' });
  if (typeof achieved === 'boolean') goal.achieved = achieved;
  await db.write();
  res.json(goal);
});

router.delete('/goals/:id', async (req, res) => {
  await db.read();
  const before = db.data.physiqueGoals.length;
  db.data.physiqueGoals = db.data.physiqueGoals.filter(g => !(g.id === req.params.id && g.userId === req.user.id));
  if (db.data.physiqueGoals.length === before) return res.status(404).json({ error: 'Objectif introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// --- RÉSUMÉ ---

router.get('/summary', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const measurements = db.data.physiqueMeasurements
    .filter(m => m.userId === uid)
    .sort((a, b) => a.date.localeCompare(b.date));
  const workouts = db.data.physiqueWorkouts.filter(w => w.userId === uid);

  const latest = measurements[measurements.length - 1] || null;
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().slice(0, 10);
  const past = [...measurements].reverse().find(m => m.date <= cutoff30Str) || measurements[0] || null;

  const trend = (field) => {
    if (!latest || !past || latest[field] == null || past[field] == null) return null;
    return Math.round((latest[field] - past[field]) * 10) / 10;
  };

  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = cutoff7.toISOString().slice(0, 10);

  res.json({
    latest,
    weightTrend30d: trend('weight'),
    waistTrend30d: trend('waist'),
    workoutsLast7Days: workouts.filter(w => w.date >= cutoff7Str).length,
    workoutsLast30Days: workouts.filter(w => w.date >= cutoff30Str).length,
    note: "Les tendances comparent ta dernière mesure à la plus proche d'il y a 30 jours — indicatif, pas un suivi médical."
  });
});

export default router;
