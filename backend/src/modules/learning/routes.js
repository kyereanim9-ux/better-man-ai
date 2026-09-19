import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Enregistre un auto-jugement de l'utilisateur après un flashcard/quiz/niveau
// ("facile" / "moyen" / "difficile"). Pas de correction automatique — c'est
// l'utilisateur qui sait s'il a réussi, ce qui reste honnête vu l'absence
// d'un vrai correcteur sémantique en mode local.
router.post('/attempts', async (req, res) => {
  const { sourceType, sourceId, label, selfRating } = req.body;
  if (!['library', 'video', 'bible', 'teach'].includes(sourceType)) {
    return res.status(400).json({ error: 'sourceType invalide.' });
  }
  if (!['facile', 'moyen', 'difficile'].includes(selfRating)) {
    return res.status(400).json({ error: 'selfRating invalide (facile, moyen ou difficile).' });
  }

  await db.read();
  const attempt = {
    id: nanoid(), userId: req.user.id, sourceType, sourceId: sourceId || null,
    label: label || sourceType, selfRating, createdAt: new Date().toISOString()
  };
  db.data.learningAttempts.push(attempt);
  await db.write();
  res.status(201).json(attempt);
});

router.get('/insights', async (req, res) => {
  await db.read();
  const attempts = db.data.learningAttempts.filter(a => a.userId === req.user.id);

  const byLabel = {};
  for (const a of attempts) {
    byLabel[a.label] ??= { facile: 0, moyen: 0, difficile: 0, total: 0, lastAt: a.createdAt };
    byLabel[a.label][a.selfRating]++;
    byLabel[a.label].total++;
    if (a.createdAt > byLabel[a.label].lastAt) byLabel[a.label].lastAt = a.createdAt;
  }

  const toReview = [];
  const mastered = [];
  for (const [label, stats] of Object.entries(byLabel)) {
    if (stats.difficile >= 2 && stats.difficile >= stats.facile) {
      toReview.push({ label, ...stats });
    } else if (stats.facile >= 3 && stats.difficile === 0) {
      mastered.push({ label, ...stats });
    }
  }

  res.json({
    totalAttempts: attempts.length,
    toReview: toReview.sort((a, b) => b.difficile - a.difficile),
    mastered: mastered.sort((a, b) => b.facile - a.facile),
    note: "Basé sur tes propres auto-évaluations (facile/moyen/difficile), pas une correction automatique du contenu."
  });
});

export default router;
