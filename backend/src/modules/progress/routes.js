import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { stripAccents } from '../../shared/textNormalize.js';

const router = Router();
router.use(requireAuth);

function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Données prêtes à tracer (14 derniers jours) : nombre d'habitudes faites par jour.
router.get('/summary', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const days = lastNDates(14);

  const habits = db.data.habits.filter(h => h.userId === uid);
  const habitsPerDay = days.map(day => ({
    date: day,
    count: habits.filter(h => h.doneDates.includes(day)).length
  }));

  const goals = db.data.goals.filter(g => g.userId === uid);
  const goalsByStatus = {
    active: goals.filter(g => g.status === 'active').length,
    done: goals.filter(g => g.status === 'done').length,
    paused: goals.filter(g => g.status === 'paused').length
  };

  const journalEntries = db.data.journalEntries.filter(j => j.userId === uid);
  const journalPerDay = days.map(day => ({
    date: day,
    count: journalEntries.filter(j => j.createdAt.slice(0, 10) === day).length
  }));

  const memorization = db.data.bibleMemorization.filter(m => m.userId === uid);
  const memorizationStats = {
    total: memorization.length,
    mastered: memorization.filter(m => m.stage >= 6).length
  };

  res.json({ habitsPerDay, goalsByStatus, journalPerDay, memorizationStats });
});

// Revue hebdomadaire simple, générée par des règles (pas d'appel IA nécessaire).
router.get('/weekly-review', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const days = lastNDates(7);

  const habits = db.data.habits.filter(h => h.userId === uid);
  const totalHabitChecks = habits.reduce(
    (sum, h) => sum + h.doneDates.filter(d => days.includes(d)).length, 0
  );
  const possibleChecks = habits.length * 7;
  const habitRate = possibleChecks ? Math.round((totalHabitChecks / possibleChecks) * 100) : null;

  const goalsCompletedThisWeek = db.data.goals.filter(
    g => g.userId === uid && g.status === 'done'
  ).length;

  const journalCount = db.data.journalEntries.filter(
    j => j.userId === uid && days.includes(j.createdAt.slice(0, 10))
  ).length;

  const lines = [];
  if (habitRate !== null) {
    lines.push(`Tu as tenu tes habitudes ${habitRate}% du temps cette semaine (${totalHabitChecks}/${possibleChecks}).`);
  } else {
    lines.push("Tu n'as pas encore d'habitude enregistrée pour suivre ta régularité.");
  }
  lines.push(`${journalCount} entrée(s) de journal cette semaine.`);
  lines.push(`${goalsCompletedThisWeek} objectif(s) marqué(s) comme fait au total.`);

  res.json({ period: { from: days[0], to: days[6] }, habitRate, journalCount, goalsCompletedThisWeek, summary: lines });
});

// Détection de tendances très simple par mots-clés dans le journal récent.
// Volontairement transparent et limité : pas d'inférence psychologique, juste
// un comptage. Motifs écrits sans accents : le texte est désaccentué avant
// comparaison (voir stripAccents), pour rester fiable même tapé vite sur mobile.
const TREND_KEYWORDS = {
  colère: /frustr|colere|enerv|agace/i,
  fatigue: /fatigu|epuise|creve/i,
  stress: /stress|anxieux|inquiet/i,
  tristesse: /triste|deprim|down/i,
  reconnaissance: /reconnaissant|content|heureux|gratitude/i
};

router.get('/trends', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const days = lastNDates(14);
  const recentEntries = db.data.journalEntries.filter(
    j => j.userId === uid && days.includes(j.createdAt.slice(0, 10))
  );

  const counts = {};
  for (const key of Object.keys(TREND_KEYWORDS)) counts[key] = 0;
  for (const entry of recentEntries) {
    const normalized = stripAccents(entry.content);
    for (const [key, regex] of Object.entries(TREND_KEYWORDS)) {
      if (regex.test(normalized)) counts[key]++;
    }
  }

  // On ne signale une tendance que si elle apparaît au moins 3 fois sur 14 jours.
  const notable = Object.entries(counts).filter(([, c]) => c >= 3).map(([key, c]) => ({ key, count: c }));

  res.json({
    entriesAnalyzed: recentEntries.length,
    notable,
    note: notable.length
      ? "Simple comptage de mots-clés sur tes 14 derniers jours de journal, pas un diagnostic."
      : "Pas encore de tendance nette détectée (il faut au moins 3 mentions du même mot-clé sur 14 jours)."
  });
});

// Revue mensuelle : compare le mois en cours au mois précédent.
router.get('/monthly-review', async (req, res) => {
  await db.read();
  const uid = req.user.id;

  function monthRange(offsetMonths) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offsetMonths);
    const prefix = d.toISOString().slice(0, 7);
    return prefix;
  }

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(1);

  function statsFor(prefix) {
    const habits = db.data.habits.filter(h => h.userId === uid);
    const habitChecks = habits.reduce(
      (s, h) => s + h.doneDates.filter(d => d.startsWith(prefix)).length, 0
    );
    const goalsDone = db.data.goals.filter(
      g => g.userId === uid && g.status === 'done' && g.completedAt?.startsWith(prefix)
    ).length;
    const journalCount = db.data.journalEntries.filter(
      j => j.userId === uid && j.createdAt.startsWith(prefix)
    ).length;
    const situationsCount = db.data.situations.filter(
      s => s.userId === uid && s.createdAt.startsWith(prefix)
    ).length;
    return { habitChecks, goalsDone, journalCount, situationsCount };
  }

  const current = statsFor(thisMonth);
  const previous = statsFor(lastMonth);

  function trend(curr, prev) {
    if (prev === 0 && curr === 0) return 'stable';
    if (prev === 0) return 'up';
    const diff = ((curr - prev) / prev) * 100;
    if (diff > 10) return 'up';
    if (diff < -10) return 'down';
    return 'stable';
  }

  res.json({
    month: thisMonth,
    previousMonth: lastMonth,
    current, previous,
    trends: {
      habits: trend(current.habitChecks, previous.habitChecks),
      goals: trend(current.goalsDone, previous.goalsDone),
      journal: trend(current.journalCount, previous.journalCount),
      situations: trend(current.situationsCount, previous.situationsCount)
    },
    reflectionQuestions: [
      "Quel a été ton plus grand accomplissement ce mois-ci ?",
      "Quelle habitude ou objectif as-tu négligé, et pourquoi ?",
      "Quelle erreur s'est répétée plusieurs fois ce mois-ci ?",
      "Quel domaine de vie mérite plus d'attention le mois prochain ?",
      "Un objectif actuel est-il devenu inutile ou dépassé ?",
      "Quelle est UNE chose que tu veux rendre un peu plus difficile le mois prochain ?"
    ]
  });
});

// Bilan du soir : 4 questions de réflexion, une entrée par jour (upsert).
router.put('/daily-reflection', async (req, res) => {
  const { accomplished, difficult, learned, differently } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  await db.read();
  let entry = db.data.dailyReflections.find(r => r.userId === req.user.id && r.date === today);
  if (entry) {
    entry.accomplished = accomplished ?? entry.accomplished;
    entry.difficult = difficult ?? entry.difficult;
    entry.learned = learned ?? entry.learned;
    entry.differently = differently ?? entry.differently;
  } else {
    entry = {
      id: nanoid(), userId: req.user.id, date: today,
      accomplished: accomplished || '', difficult: difficult || '', learned: learned || '', differently: differently || '',
      createdAt: new Date().toISOString()
    };
    db.data.dailyReflections.push(entry);
  }
  await db.write();
  res.json(entry);
});

router.get('/daily-reflection', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  await db.read();
  const entry = db.data.dailyReflections.find(r => r.userId === req.user.id && r.date === today);
  res.json(entry || null);
});

router.get('/daily-reflections/recent', async (req, res) => {
  await db.read();
  const list = db.data.dailyReflections
    .filter(r => r.userId === req.user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  res.json(list);
});

export default router;
