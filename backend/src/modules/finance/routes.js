import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// --- TRANSACTIONS (revenus / dépenses) ---

router.get('/transactions', async (req, res) => {
  await db.read();
  const list = db.data.financeTransactions
    .filter(t => t.userId === req.user.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json(list);
});

router.post('/transactions', async (req, res) => {
  const { type, amount, category, note, date } = req.body;
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type invalide (income ou expense).' });
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

  await db.read();
  const tx = {
    id: nanoid(), userId: req.user.id, type, amount: numAmount,
    category: category || 'autre', note: note || '',
    date: date || new Date().toISOString().slice(0, 10)
  };
  db.data.financeTransactions.push(tx);
  await db.write();
  res.status(201).json(tx);
});

router.delete('/transactions/:id', async (req, res) => {
  await db.read();
  const before = db.data.financeTransactions.length;
  db.data.financeTransactions = db.data.financeTransactions.filter(
    t => !(t.id === req.params.id && t.userId === req.user.id)
  );
  if (db.data.financeTransactions.length === before) return res.status(404).json({ error: 'Transaction introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// Résumé du mois en cours : entrées, sorties, solde, répartition par catégorie.
router.get('/summary', async (req, res) => {
  await db.read();
  const monthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const txs = db.data.financeTransactions.filter(
    t => t.userId === req.user.id && t.date.startsWith(monthPrefix)
  );

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const byCategory = {};
  for (const t of txs.filter(t => t.type === 'expense')) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }

  res.json({
    month: monthPrefix,
    income, expense, balance: income - expense,
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  });
});

// --- OBJECTIFS D'ÉPARGNE ---

router.get('/savings-goals', async (req, res) => {
  await db.read();
  res.json(db.data.financeSavingsGoals.filter(g => g.userId === req.user.id));
});

router.post('/savings-goals', async (req, res) => {
  const { title, targetAmount } = req.body;
  if (!title?.trim() || !targetAmount || targetAmount <= 0) {
    return res.status(400).json({ error: 'Titre et montant cible requis.' });
  }
  await db.read();
  const goal = {
    id: nanoid(), userId: req.user.id, title,
    targetAmount: Number(targetAmount), savedAmount: 0, createdAt: new Date().toISOString()
  };
  db.data.financeSavingsGoals.push(goal);
  await db.write();
  res.status(201).json(goal);
});

router.post('/savings-goals/:id/add', async (req, res) => {
  const { amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  await db.read();
  const goal = db.data.financeSavingsGoals.find(g => g.id === req.params.id && g.userId === req.user.id);
  if (!goal) return res.status(404).json({ error: 'Objectif d\'épargne introuvable.' });
  goal.savedAmount = Math.min(goal.targetAmount, goal.savedAmount + numAmount);
  await db.write();
  res.json(goal);
});

router.delete('/savings-goals/:id', async (req, res) => {
  await db.read();
  const before = db.data.financeSavingsGoals.length;
  db.data.financeSavingsGoals = db.data.financeSavingsGoals.filter(
    g => !(g.id === req.params.id && g.userId === req.user.id)
  );
  if (db.data.financeSavingsGoals.length === before) return res.status(404).json({ error: 'Objectif introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// Investissements : simple suivi + projection par intérêts composés à partir
// d'un taux ANNUEL QUE L'UTILISATEUR RENSEIGNE LUI-MÊME. L'app ne recommande
// aucun taux, aucun produit financier — c'est un calculateur, pas un conseil.
function compoundProjection(amount, annualRatePercent, months) {
  const monthlyRate = annualRatePercent / 100 / 12;
  const projected = amount * Math.pow(1 + monthlyRate, months);
  return Math.round(projected * 100) / 100;
}

router.get('/investments', async (req, res) => {
  await db.read();
  const list = db.data.financeInvestments
    .filter(i => i.userId === req.user.id)
    .map(i => ({ ...i, projectedValue: compoundProjection(i.amount, i.annualRatePercent, i.horizonMonths) }));
  res.json(list);
});

router.post('/investments', async (req, res) => {
  const { name, type, amount, annualRatePercent, horizonMonths, note } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  const numRate = Number(annualRatePercent);
  if (isNaN(numRate)) return res.status(400).json({ error: 'Taux annuel invalide.' });
  const numMonths = Number(horizonMonths);
  if (!numMonths || numMonths <= 0) return res.status(400).json({ error: 'Horizon (en mois) invalide.' });

  await db.read();
  const investment = {
    id: nanoid(), userId: req.user.id, name, type: type || 'autre',
    amount: numAmount, annualRatePercent: numRate, horizonMonths: numMonths,
    note: note || '', createdAt: new Date().toISOString()
  };
  db.data.financeInvestments.push(investment);
  await db.write();
  res.status(201).json({ ...investment, projectedValue: compoundProjection(numAmount, numRate, numMonths) });
});

router.delete('/investments/:id', async (req, res) => {
  await db.read();
  const before = db.data.financeInvestments.length;
  db.data.financeInvestments = db.data.financeInvestments.filter(
    i => !(i.id === req.params.id && i.userId === req.user.id)
  );
  if (db.data.financeInvestments.length === before) return res.status(404).json({ error: 'Investissement introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
