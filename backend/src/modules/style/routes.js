import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

const AREAS = [
  {
    id: 'vetements',
    title: 'Vêtements',
    prompts: [
      "Mes vêtements actuels correspondent-ils à l'image que je veux donner ?",
      "Ai-je 3 tenues sur lesquelles je peux compter pour me sentir bien, quelle que soit l'occasion ?"
    ]
  },
  {
    id: 'hygiene',
    title: 'Hygiène',
    prompts: ["Ma routine d'hygiène quotidienne est-elle vraiment régulière, ou dépend-elle de mon humeur ?"]
  },
  {
    id: 'coiffure',
    title: 'Coiffure',
    prompts: ["Ma coupe actuelle est-elle entretenue, ou est-ce que je la repousse depuis trop longtemps ?"]
  },
  {
    id: 'parfum',
    title: 'Parfum',
    prompts: ["Est-ce que je porte un parfum de façon cohérente, ni absent ni excessif ?"]
  },
  {
    id: 'soins-peau',
    title: 'Soins de la peau',
    prompts: ["Ai-je une routine simple (nettoyage, hydratation) que je tiens vraiment ?"]
  },
  {
    id: 'posture',
    title: 'Posture',
    prompts: ["Comment est ma posture quand je ne fais pas attention — épaules, dos, tête ?"]
  },
  {
    id: 'langage-corporel',
    title: 'Langage corporel',
    prompts: ["Est-ce que mon langage corporel reflète la confiance que je veux projeter ?"]
  },
  {
    id: 'presentation-generale',
    title: 'Présentation générale',
    prompts: ["Si je me voyais de l'extérieur aujourd'hui, qu'est-ce que je remarquerais en premier ?"]
  }
];

router.get('/checklist', (req, res) => {
  res.json(AREAS);
});

router.get('/entries', async (req, res) => {
  await db.read();
  const list = db.data.styleEntries
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

router.post('/entries', async (req, res) => {
  const { area, note } = req.body;
  if (!AREAS.some(a => a.id === area)) return res.status(400).json({ error: 'Domaine invalide.' });
  if (!note?.trim()) return res.status(400).json({ error: 'Note vide.' });
  await db.read();
  const entry = { id: nanoid(), userId: req.user.id, area, note, createdAt: new Date().toISOString() };
  db.data.styleEntries.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/entries/:id', async (req, res) => {
  await db.read();
  const before = db.data.styleEntries.length;
  db.data.styleEntries = db.data.styleEntries.filter(e => !(e.id === req.params.id && e.userId === req.user.id));
  if (db.data.styleEntries.length === before) return res.status(404).json({ error: 'Entrée introuvable.' });
  await db.write();
  res.json({ ok: true });
});

router.get('/overview', async (req, res) => {
  await db.read();
  const entries = db.data.styleEntries.filter(e => e.userId === req.user.id);
  const coveredAreas = new Set(entries.map(e => e.area));
  const neverAddressed = AREAS.filter(a => !coveredAreas.has(a.id)).map(a => a.title);
  res.json({
    totalEntries: entries.length,
    neverAddressed,
    note: neverAddressed.length
      ? "Domaines sur lesquels tu n'as encore rien noté — pas forcément un problème, juste un angle mort possible."
      : "Tu as déjà écrit sur chaque domaine au moins une fois."
  });
});

// Routine skincare coréenne (10 étapes classiques) — suivi de complétion,
// jamais d'analyse de peau par photo.
const SKINCARE_STEPS = {
  am: ['nettoyant-doux', 'toner', 'essence', 'serum', 'contour-yeux', 'hydratant', 'spf'],
  pm: ['huile-demaquillante', 'nettoyant-doux', 'exfoliant-2-3x-semaine', 'toner', 'essence', 'serum', 'contour-yeux', 'masque-nuit-hydratant']
};

router.get('/skincare/steps', (req, res) => res.json(SKINCARE_STEPS));

router.get('/skincare', async (req, res) => {
  await db.read();
  const list = db.data.skincareLogs
    .filter(s => s.userId === req.user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  res.json(list);
});

router.put('/skincare', async (req, res) => {
  const { amSteps, pmSteps } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  await db.read();
  let entry = db.data.skincareLogs.find(s => s.userId === req.user.id && s.date === today);
  if (entry) {
    if (Array.isArray(amSteps)) entry.amSteps = amSteps;
    if (Array.isArray(pmSteps)) entry.pmSteps = pmSteps;
  } else {
    entry = { id: nanoid(), userId: req.user.id, date: today, amSteps: amSteps || [], pmSteps: pmSteps || [] };
    db.data.skincareLogs.push(entry);
  }
  await db.write();
  res.json(entry);
});

export default router;
