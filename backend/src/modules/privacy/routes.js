import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../middleware/auth.js';
import { db, purgeUserData } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Exporte toutes les données personnelles de l'utilisateur connecté, dans
// toutes les collections. Ne contient jamais le hash du mot de passe.
router.get('/export', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const user = db.data.users.find(u => u.id === uid);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    onboarding: user.onboarding || null,
    conversations: db.data.conversations.filter(c => c.userId === uid),
    journalEntries: db.data.journalEntries.filter(j => j.userId === uid),
    habits: db.data.habits.filter(h => h.userId === uid),
    goals: db.data.goals.filter(g => g.userId === uid),
    bibleMemorization: db.data.bibleMemorization.filter(m => m.userId === uid),
    situations: db.data.situations.filter(s => s.userId === uid),
    financeTransactions: db.data.financeTransactions.filter(t => t.userId === uid),
    financeSavingsGoals: db.data.financeSavingsGoals.filter(g => g.userId === uid),
    libraryItems: db.data.libraryItems.filter(b => b.userId === uid),
    videos: db.data.videos.filter(v => v.userId === uid),
    teachTopics: db.data.teachTopics.filter(t => t.userId === uid),
    learningAttempts: db.data.learningAttempts.filter(a => a.userId === uid),
    intimacyEntries: db.data.intimacyEntries.filter(e => e.userId === uid),
    physiqueMeasurements: db.data.physiqueMeasurements.filter(m => m.userId === uid),
    physiqueWorkouts: db.data.physiqueWorkouts.filter(w => w.userId === uid),
    physiqueGoals: db.data.physiqueGoals.filter(g => g.userId === uid),
    styleEntries: db.data.styleEntries.filter(e => e.userId === uid)
  };

  res.setHeader('Content-Disposition', 'attachment; filename="better-man-ai-export.json"');
  res.json(exportData);
});

// Suppression définitive du compte et de toutes ses données, à la demande de
// l'utilisateur lui-même (pas besoin d'être admin). Exige de retaper son mot
// de passe pour éviter une suppression accidentelle.
router.post('/delete-account', async (req, res) => {
  const { password } = req.body;
  await db.read();
  const uid = req.user.id;
  const user = db.data.users.find(u => u.id === uid);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect.' });

  purgeUserData(uid);
  await db.write();

  res.json({ ok: true });
});

export default router;
