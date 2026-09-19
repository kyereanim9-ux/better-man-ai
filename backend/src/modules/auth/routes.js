import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { db } from '../../db.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email et mot de passe (8 caractères minimum) requis.' });
  }
  await db.read();
  const exists = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });

  const passwordHash = await bcrypt.hash(password, 10);
  // Le tout premier utilisateur créé, ou celui correspondant à ADMIN_BOOTSTRAP_EMAIL, devient admin.
  const isFirstUser = db.data.users.length === 0;
  const isBootstrapAdmin = process.env.ADMIN_BOOTSTRAP_EMAIL &&
    email.toLowerCase() === process.env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase();

  const user = {
    id: nanoid(),
    email,
    passwordHash,
    name: name || email.split('@')[0],
    role: (isFirstUser || isBootstrapAdmin) ? 'admin' : 'user',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.data.users.push(user);
  await db.write();

  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar || null } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });
  if (!user.active) return res.status(403).json({ error: 'Ce compte a été désactivé.' });

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar || null } });
});

export default router;
