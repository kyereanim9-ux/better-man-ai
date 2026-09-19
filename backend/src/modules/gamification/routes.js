import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Les niveaux représentent la progression dans l'usage de l'app, jamais la
// valeur personnelle de l'utilisateur (voir cahier des charges §12).
const LEVELS = [
  { level: 1, name: 'Building the Foundation', minXp: 0 },
  { level: 2, name: 'Building Discipline', minXp: 100 },
  { level: 3, name: 'Emotional Control', minXp: 250 },
  { level: 4, name: 'Strong Relationships', minXp: 500 },
  { level: 5, name: 'Financial Discipline', minXp: 900 },
  { level: 6, name: 'Professional Growth', minXp: 1400 },
  { level: 7, name: 'Complete Self-Mastery', minXp: 2000 }
];

function computeStreak(habits) {
  const doneDates = new Set();
  for (const h of habits) for (const d of h.doneDates) doneDates.add(d);
  if (doneDates.size === 0) return 0;

  const today = new Date();
  let cursor = new Date(today);
  // Si rien n'est fait aujourd'hui, la série peut quand même être "en vie"
  // jusqu'à hier soir : on démarre le comptage à hier dans ce cas.
  if (!doneDates.has(today.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (doneDates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

router.get('/status', async (req, res) => {
  await db.read();
  const uid = req.user.id;

  const habits = db.data.habits.filter(h => h.userId === uid);
  const goals = db.data.goals.filter(g => g.userId === uid);
  const journalEntries = db.data.journalEntries.filter(j => j.userId === uid);
  const situations = db.data.situations.filter(s => s.userId === uid);
  const memorization = db.data.bibleMemorization.filter(m => m.userId === uid);

  const habitsCompletedTotal = habits.reduce((s, h) => s + h.doneDates.length, 0);
  const goalsDoneTotal = goals.filter(g => g.status === 'done').length;
  const journalTotal = journalEntries.length;
  const situationsTotal = situations.length;
  const bibleMasteredTotal = memorization.filter(m => m.stage >= 6).length;
  const bibleInProgressTotal = memorization.length - bibleMasteredTotal;

  const xp =
    habitsCompletedTotal * 5 +
    goalsDoneTotal * 20 +
    journalTotal * 5 +
    situationsTotal * 8 +
    bibleMasteredTotal * 15 +
    bibleInProgressTotal * 3;

  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) { current = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  const progressToNext = next ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100;

  const streak = computeStreak(habits);

  const badges = [];
  if (habits.length >= 1) badges.push({ key: 'first_habit', label: 'Premier pas' });
  if (streak >= 7) badges.push({ key: 'streak_7', label: '7 jours d\'affilée' });
  if (streak >= 30) badges.push({ key: 'streak_30', label: '30 jours d\'affilée' });
  if (journalTotal >= 10) badges.push({ key: 'journal_10', label: 'Journal régulier' });
  if (bibleMasteredTotal >= 1) badges.push({ key: 'verse_mastered', label: 'Premier verset maîtrisé' });
  if (situationsTotal >= 1) badges.push({ key: 'first_situation', label: 'Première situation analysée' });
  if (goalsDoneTotal >= 1) badges.push({ key: 'first_goal', label: 'Premier objectif atteint' });
  if (goalsDoneTotal >= 10) badges.push({ key: 'goals_10', label: '10 objectifs atteints' });

  res.json({
    xp, level: current.level, levelName: current.name,
    nextLevel: next ? { level: next.level, name: next.name, xpNeeded: next.minXp - xp } : null,
    progressToNext, streak, badges,
    levels: LEVELS,
    note: "Le niveau reflète ton usage de l'application, pas ta valeur personnelle."
  });
});

export default router;
