import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { computeStatus } from '../bible/spacedRepetition.js';

const router = Router();
router.use(requireAuth);

// Génère un programme du jour simple à partir des habitudes non faites
// aujourd'hui, des objectifs actifs et des versets bibliques à réviser.
// La vraie "learning engine" adaptative arrive en Phase 5.
router.get('/', async (req, res) => {
  await db.read();
  const today = new Date().toISOString().slice(0, 10);

  const habits = db.data.habits.filter(h => h.userId === req.user.id);
  const goals = db.data.goals.filter(g => g.userId === req.user.id && g.status === 'active');
  const memorization = db.data.bibleMemorization.filter(m => m.userId === req.user.id).map(computeStatus);
  const dueVerses = memorization.filter(m => m.isDue);

  const pendingHabits = habits.filter(h => !h.doneDates.includes(today));
  // Limite pour éviter la surcharge, comme demandé dans le cahier des charges.
  const missionHabits = pendingHabits.slice(0, 3).map(h => ({ type: 'habit', id: h.id, title: h.title }));
  const missionGoals = goals.slice(0, 2).map(g => ({ type: 'goal', id: g.id, title: g.title, category: g.category }));
  const missionBible = dueVerses.slice(0, 2).map(m => ({ type: 'bible', id: m.id, title: `${m.ref} — ${m.stageLabel}` }));

  res.json({
    date: today,
    habitsDoneToday: habits.length - pendingHabits.length,
    habitsTotal: habits.length,
    mission: [...missionHabits, ...missionGoals, ...missionBible],
    suggestion: (pendingHabits.length === 0 && goals.length === 0 && dueVerses.length === 0)
      ? "Aucune habitude, objectif ou verset à réviser pour l'instant. Ajoute-en un pour démarrer ton programme du jour."
      : "Concentre-toi sur ces quelques actions aujourd'hui, plutôt que d'en faire trop d'un coup."
  });
});

export default router;

