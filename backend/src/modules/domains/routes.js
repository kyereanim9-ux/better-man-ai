import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db, DOMAINS } from '../../db.js';
import { detectDomains } from '../../shared/domainKeywords.js';

const router = Router();
router.use(requireAuth);

function cutoffDate(days) {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isInPeriod(dateStr, days) {
  if (days === null) return true;
  const cutoff = cutoffDate(days);
  return dateStr.slice(0, 10) >= cutoff;
}

// Calcule un score indicatif (0-100) par domaine, pour une période donnée.
// IMPORTANT : ce n'est pas une mesure scientifique, juste un indicateur
// d'activité relative pour visualiser la progression (voir cahier des charges §4).
function computeScores(uid, days) {
  const today = new Date().toISOString().slice(0, 10);
  const points = Object.fromEntries(DOMAINS.map(d => [d, 0]));

  const habits = db.data.habits.filter(h => h.userId === uid);
  for (const h of habits) {
    const domain = DOMAINS.includes(h.domain) ? h.domain : 'discipline';
    const doneInPeriod = h.doneDates.filter(d => days === 0 ? d === today : isInPeriod(d, days));
    points[domain] += doneInPeriod.length * 3;
  }

  const goals = db.data.goals.filter(g => g.userId === uid);
  for (const g of goals) {
    if (!DOMAINS.includes(g.category)) continue;
    if (g.status === 'done' && g.completedAt) {
      if (days === 0 ? g.completedAt.slice(0, 10) === today : isInPeriod(g.completedAt, days)) {
        points[g.category] += 8;
      }
    } else if (g.status === 'active' && isInPeriod(g.createdAt, days)) {
      points[g.category] += 1; // simple bonus pour objectif actif récent
    }
  }

  const journalEntries = db.data.journalEntries.filter(j => j.userId === uid);
  for (const j of journalEntries) {
    const inPeriod = days === 0 ? j.createdAt.slice(0, 10) === today : isInPeriod(j.createdAt, days);
    if (!inPeriod) continue;
    for (const d of detectDomains(j.content, [])) points[d] += 2;
  }

  const situations = db.data.situations.filter(s => s.userId === uid);
  for (const s of situations) {
    const inPeriod = days === 0 ? s.createdAt.slice(0, 10) === today : isInPeriod(s.createdAt, days);
    if (!inPeriod) continue;
    for (const d of s.domains) points[d] += 2;
  }

  // La mémorisation biblique alimente le domaine spirituel.
  const memorization = db.data.bibleMemorization.filter(m => m.userId === uid);
  for (const m of memorization) {
    const inPeriod = days === 0 ? m.startedAt.slice(0, 10) === today : isInPeriod(m.startedAt, days);
    if (inPeriod) points.spirituel += (m.stage >= 6 ? 5 : 2);
  }

  // Les entraînements (module Physique, Phase 7) alimentent le domaine physique —
  // sinon quelqu'un qui logue des séances tous les jours voyait son score
  // physique rester à zéro tant qu'il ne cochait pas aussi une habitude
  // rattachée à ce domaine, ce qui n'avait pas de sens.
  const workouts = db.data.physiqueWorkouts.filter(w => w.userId === uid);
  for (const w of workouts) {
    const inPeriod = days === 0 ? w.date === today : isInPeriod(w.date, days);
    if (inPeriod) points.physique += 3;
  }

  // Même logique pour le suivi financier (Phase 3) : logguer ses transactions
  // est une forme d'activité dans le domaine "financier", même sans habitude
  // ou objectif dédié.
  const transactions = db.data.financeTransactions.filter(t => t.userId === uid);
  for (const t of transactions) {
    const inPeriod = days === 0 ? t.date === today : isInPeriod(t.date, days);
    if (inPeriod) points.financier += 1;
  }

  // Et pour le journal privé Intimité (Phase 6) : tenir ce journal est une
  // activité dans le domaine "intime".
  const intimacyEntries = db.data.intimacyEntries.filter(e => e.userId === uid);
  for (const e of intimacyEntries) {
    const inPeriod = days === 0 ? e.createdAt.slice(0, 10) === today : isInPeriod(e.createdAt, days);
    if (inPeriod) points.intime += 2;
  }

  // Normalisation simple : plafonnée à 100, échelle choisie pour qu'une
  // semaine active tourne autour de 60-80, sans jamais prétendre être scientifique.
  const scale = days === 0 ? 10 : days === 7 ? 4 : days === 30 ? 1.2 : 0.3;
  const scores = {};
  for (const d of DOMAINS) scores[d] = Math.min(100, Math.round(points[d] * scale));
  return scores;
}

router.get('/scores', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  res.json({
    domains: DOMAINS,
    today: computeScores(uid, 0),
    week: computeScores(uid, 7),
    month: computeScores(uid, 30),
    allTime: computeScores(uid, null),
    note: "Ces scores sont des indicateurs d'activité relative, pas une mesure scientifique de ta valeur ou de ta personnalité."
  });
});

export default router;
