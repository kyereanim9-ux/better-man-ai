import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Trame pédagogique générique (progression classique : bases -> compréhension
// -> pratique -> application réelle -> enseigner = maîtrise). Ce n'est pas un
// contenu spécifique au sujet choisi (l'app n'a pas de vraie expertise sans
// LLM payant) — c'est une méthode de travail applicable à n'importe quel sujet.
const LEVEL_TEMPLATE = [
  { key: 'fondations', label: 'Niveau 1 — Fondations', action: "Trouve une introduction fiable au sujet (article, vidéo, chapitre) et note 5 idées de base." },
  { key: 'comprehension', label: 'Niveau 2 — Compréhension', action: "Explique le sujet avec tes propres mots, comme si tu l'expliquais à un débutant complet." },
  { key: 'pratique', label: 'Niveau 3 — Pratique', action: "Fais un exercice concret lié au sujet (mini-projet, mise en situation, calcul, rédaction...)." },
  { key: 'application', label: 'Niveau 4 — Application réelle', action: "Utilise ce que tu as appris dans une vraie situation de ta vie, cette semaine." },
  { key: 'maitrise', label: 'Niveau 5 — Maîtrise', action: "Enseigne ce sujet à quelqu'un d'autre, ou écris un résumé complet comme si tu devais le publier." }
];

router.post('/topics', async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Sujet requis.' });

  await db.read();
  const item = {
    id: nanoid(), userId: req.user.id, topic,
    levels: LEVEL_TEMPLATE.map(l => ({ ...l, completed: false, completedAt: null })),
    createdAt: new Date().toISOString()
  };
  db.data.teachTopics.push(item);
  await db.write();
  res.status(201).json(item);
});

router.get('/topics', async (req, res) => {
  await db.read();
  const list = db.data.teachTopics.filter(t => t.userId === req.user.id).map(t => ({
    id: t.id, topic: t.topic, createdAt: t.createdAt,
    progress: Math.round((t.levels.filter(l => l.completed).length / t.levels.length) * 100),
    currentLevel: t.levels.find(l => !l.completed)?.label || 'Terminé — maîtrise atteinte'
  }));
  res.json(list);
});

router.get('/topics/:id', async (req, res) => {
  await db.read();
  const item = db.data.teachTopics.find(t => t.id === req.params.id && t.userId === req.user.id);
  if (!item) return res.status(404).json({ error: 'Sujet introuvable.' });
  res.json(item);
});

// Ne permet de valider un niveau que si le précédent est déjà fait, pour
// respecter la progression demandée (§13 : augmenter progressivement la difficulté).
router.post('/topics/:id/levels/:key/complete', async (req, res) => {
  await db.read();
  const item = db.data.teachTopics.find(t => t.id === req.params.id && t.userId === req.user.id);
  if (!item) return res.status(404).json({ error: 'Sujet introuvable.' });

  const levelIndex = item.levels.findIndex(l => l.key === req.params.key);
  if (levelIndex === -1) return res.status(404).json({ error: 'Niveau introuvable.' });
  if (levelIndex > 0 && !item.levels[levelIndex - 1].completed) {
    return res.status(400).json({ error: 'Termine d\'abord le niveau précédent.' });
  }

  item.levels[levelIndex].completed = true;
  item.levels[levelIndex].completedAt = new Date().toISOString();
  await db.write();
  res.json(item);
});

router.delete('/topics/:id', async (req, res) => {
  await db.read();
  const before = db.data.teachTopics.length;
  db.data.teachTopics = db.data.teachTopics.filter(t => !(t.id === req.params.id && t.userId === req.user.id));
  if (db.data.teachTopics.length === before) return res.status(404).json({ error: 'Sujet introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
