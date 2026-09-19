import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Champs acceptés du questionnaire initial. Tout est optionnel : l'utilisateur
// peut compléter son profil progressivement plutôt que tout remplir d'un coup.
const FIELDS = [
  'age', 'situationPersonnelle', 'situationAmoureuse',
  'travail', 'finances', 'sommeil', 'alimentation', 'activitePhysique',
  'confianceEnSoi', 'gestionEmotions', 'communication', 'relations',
  'intimite', 'carriere', 'competences', 'spiritualite',
  'habitudesNumeriques', 'tempsDisponible',
  'forces', 'faiblesses', 'mauvaisesHabitudes', 'bonnesHabitudes',
  'objectifs30j', 'objectifs90j', 'objectifs1an', 'visionHomme'
];

router.get('/', async (req, res) => {
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({
    completed: !!user.onboarding?.completed,
    fields: FIELDS,
    answers: user.onboarding?.answers || {}
  });
});

// Sauvegarde partielle ou complète. Passer completed:true une fois que
// l'utilisateur considère le questionnaire terminé (il peut le rouvrir plus tard).
router.put('/', async (req, res) => {
  const { answers, completed } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  user.onboarding ??= { answers: {}, completed: false };
  if (answers && typeof answers === 'object') {
    for (const key of FIELDS) {
      if (key in answers) user.onboarding.answers[key] = answers[key];
    }
  }
  if (typeof completed === 'boolean') user.onboarding.completed = completed;

  await db.write();
  res.json({ completed: user.onboarding.completed, answers: user.onboarding.answers });
});

export default router;
