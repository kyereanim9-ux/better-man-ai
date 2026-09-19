import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db, DOMAINS } from '../../db.js';

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

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Analyse purement à la demande (pas de tâche planifiée : une app gratuite
// auto-hébergée n'a pas de serveur toujours actif pour ça — voir ROADMAP).
router.get('/suggestions', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const days14 = lastNDates(14);
  const days7 = lastNDates(7);

  const habits = db.data.habits.filter(h => h.userId === uid);
  const goals = db.data.goals.filter(g => g.userId === uid);
  const situations = db.data.situations.filter(s => s.userId === uid);

  const suggestions = [];

  for (const h of habits) {
    const age = daysSince(h.createdAt);
    if (age < 7) continue;
    const doneIn14 = h.doneDates.filter(d => days14.includes(d)).length;
    const rate = doneIn14 / 14;
    if (age >= 14 && rate >= 0.9) {
      suggestions.push({
        type: 'increase_difficulty',
        target: h.title,
        message: `"${h.title}" est tenue ${Math.round(rate * 100)}% du temps depuis 2 semaines. Envisage de la rendre plus exigeante ou d'ajouter une nouvelle habitude dans le même domaine.`
      });
    } else if (rate <= 0.3) {
      suggestions.push({
        type: 'reduce_load',
        target: h.title,
        message: `"${h.title}" n'est tenue que ${Math.round(rate * 100)}% du temps récemment. Envisage de la simplifier ou de la mettre en pause plutôt que d'accumuler l'échec.`
      });
    }
  }

  const days30 = lastNDates(30);
  const domainActivity = Object.fromEntries(DOMAINS.map(d => [d, 0]));
  for (const h of habits) {
    const domain = DOMAINS.includes(h.domain) ? h.domain : 'discipline';
    domainActivity[domain] += h.doneDates.filter(d => days30.includes(d)).length;
  }
  for (const g of goals) {
    if (DOMAINS.includes(g.category) && g.status !== 'paused') domainActivity[g.category] += 1;
  }
  // Même correctif que domains/routes.js : les entraînements du module
  // Physique comptent pour le domaine physique, sinon "reintroduce_domain"
  // pouvait se déclencher à tort pour quelqu'un qui s'entraîne activement.
  const workouts = db.data.physiqueWorkouts.filter(w => w.userId === uid);
  domainActivity.physique += workouts.filter(w => days30.includes(w.date)).length;
  // Idem pour les transactions (financier) et le journal Intimité (intime).
  const transactions = db.data.financeTransactions.filter(t => t.userId === uid);
  domainActivity.financier += transactions.filter(t => days30.includes(t.date)).length;
  const intimacyEntries = db.data.intimacyEntries.filter(e => e.userId === uid);
  domainActivity.intime += intimacyEntries.filter(e => days30.includes(e.createdAt.slice(0, 10))).length;
  const totalActivity = Object.values(domainActivity).reduce((a, b) => a + b, 0);
  if (totalActivity > 0) {
    const neglected = DOMAINS.filter(d => domainActivity[d] === 0);
    for (const d of neglected.slice(0, 3)) {
      suggestions.push({
        type: 'reintroduce_domain',
        target: d,
        message: `Aucune activité détectée dans le domaine "${d}" ces 30 derniers jours. Si ce domaine compte pour toi, ajoute-y une petite habitude ou un objectif, même modeste.`
      });
    }
  }

  for (const g of goals.filter(g => g.status === 'active')) {
    if (daysSince(g.createdAt) >= 60) {
      suggestions.push({
        type: 'review_goal',
        target: g.title,
        message: `L'objectif "${g.title}" est actif depuis plus de 60 jours. Est-il toujours pertinent ? Modifie-le, simplifie-le, ou abandonne-le consciemment.`
      });
    }
  }

  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  if (activeGoalsCount > 6) {
    suggestions.push({
      type: 'reduce_scope',
      target: 'objectifs',
      message: `Tu as ${activeGoalsCount} objectifs actifs en même temps. Au-delà de 5-6, la dispersion guette.`
    });
  }

  const recentSituations7d = situations.filter(s => days7.includes(s.createdAt.slice(0, 10))).length;
  if (recentSituations7d >= 5) {
    suggestions.push({
      type: 'high_friction_week',
      target: 'situations',
      message: `${recentSituations7d} situations réelles enregistrées cette semaine, plus que d'habitude. Regarde l'onglet "Schémas répétitifs".`
    });
  }

  res.json({
    suggestions,
    note: "Analyse simple basée sur tes propres données, pas une IA qui te comprend — à toi de juger ce qui est pertinent."
  });
});

export default router;
