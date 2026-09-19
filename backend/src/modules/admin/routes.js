import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { db, purgeUserData } from '../../db.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Liste des utilisateurs : uniquement les métadonnées de compte,
// jamais le contenu privé (journal, chats, objectifs...).
router.get('/users', async (req, res) => {
  await db.read();
  const users = db.data.users.map(u => ({
    id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt
  }));
  res.json(users);
});

router.patch('/users/:id', async (req, res) => {
  const { active, role } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (typeof active === 'boolean') user.active = active;
  if (role === 'user' || role === 'admin') user.role = role;
  await db.write();
  res.json({ id: user.id, email: user.email, active: user.active, role: user.role });
});

// Suppression du compte ET de toutes ses données privées associées.
router.delete('/users/:id', async (req, res) => {
  await db.read();
  purgeUserData(req.params.id);
  await db.write();
  res.json({ ok: true });
});

export default router;
