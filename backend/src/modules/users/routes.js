import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Limite raisonnable pour une photo de profil encodée en base64 (~500 Ko de
// données brutes ; le frontend redimensionne déjà l'image avant l'envoi,
// cette limite est une sécurité côté serveur contre un abus).
const MAX_AVATAR_LENGTH = 700000;

router.get('/me', async (req, res) => {
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar || null, createdAt: user.createdAt });
});

router.patch('/me', async (req, res) => {
  const { name, avatar } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (name) user.name = name;
  if (avatar !== undefined) {
    if (avatar === null) {
      user.avatar = null;
    } else {
      if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Format de photo invalide.' });
      }
      if (avatar.length > MAX_AVATAR_LENGTH) {
        return res.status(400).json({ error: 'Photo trop volumineuse.' });
      }
      user.avatar = avatar;
    }
  }
  await db.write();
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar || null });
});

export default router;
