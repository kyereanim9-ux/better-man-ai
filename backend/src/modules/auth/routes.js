import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { db } from '../../db.js';
import { createResetLink, findValidReset, RESET_TTL_MIN } from './passwordReset.js';
import { isMailConfigured, sendMail } from '../../shared/mailer.js';

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

// Mot de passe oublié : seul un email enregistré est accepté (choix de
// l'app : l'inscription indique déjà si un email est pris). Le lien part
// toujours à l'adresse du compte enregistrée en base, jamais à une autre.
router.post('/forgot', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const done = () => res.json({ ok: true, message: 'Un lien pour choisir un nouveau mot de passe vient d\'être envoyé à ton adresse email. Pense à regarder dans les spams.' });
  if (!email) return res.status(400).json({ error: 'Indique ton email.' });
  if (!isMailConfigured()) {
    return res.status(503).json({ error: 'L\'envoi d\'emails n\'est pas encore configuré. Demande à l\'administrateur un lien de réinitialisation.' });
  }
  await db.read();
  const user = db.data.users.find(u => u.email.toLowerCase() === email);
  if (!user) return res.status(404).json({ error: 'Aucun compte n\'utilise cet email. Vérifie l\'adresse utilisée lors de l\'inscription.' });
  if (!user.active) return res.status(403).json({ error: 'Ce compte a été désactivé. Contacte l\'administrateur.' });
  const link = createResetLink(user.id);
  if (!link) return res.status(429).json({ error: 'Trop de demandes pour ce compte. Utilise le dernier email reçu ou réessaie dans une heure.' });
  await db.write();
  try {
    await sendMail({
      to: user.email,
      subject: 'Better Man AI — choisir un nouveau mot de passe',
      text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable ${RESET_TTL_MIN} minutes, une seule fois) :\n${link}\n\nSi tu n'as rien demandé, ignore cet email : ton mot de passe actuel reste valable.\n\nBetter Man AI`,
      html: `<p>Bonjour ${escapeHtml(user.name)},</p><p>Pour choisir un nouveau mot de passe, appuie sur le bouton ci-dessous (valable ${RESET_TTL_MIN} minutes, une seule fois) :</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Choisir un nouveau mot de passe</a></p><p style="color:#666;font-size:13px">Si tu n'as rien demandé, ignore cet email : ton mot de passe actuel reste valable.</p>`
    });
  } catch (err) {
    console.error('[mot de passe oublié] envoi impossible :', err.message);
    return res.status(502).json({ error: 'L\'email n\'a pas pu être envoyé. Réessaie plus tard ou demande un lien à l\'administrateur.' });
  }
  done();
});

// Vérifie un lien avant d'afficher le formulaire.
router.get('/reset/:token', async (req, res) => {
  await db.read();
  const r = findValidReset(req.params.token);
  if (!r) return res.status(400).json({ error: 'Ce lien n\'est plus valable. Demande un nouveau lien.' });
  const user = db.data.users.find(u => u.id === r.userId);
  res.json({ ok: true, email: user?.email || '' });
});

router.post('/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  await db.read();
  const r = findValidReset(token);
  if (!r) return res.status(400).json({ error: 'Ce lien n\'est plus valable. Demande un nouveau lien.' });
  const user = db.data.users.find(u => u.id === r.userId);
  if (!user || !user.active) return res.status(400).json({ error: 'Compte introuvable ou désactivé.' });
  user.passwordHash = await bcrypt.hash(String(password), 10);
  r.usedAt = new Date().toISOString();
  await db.write();
  res.json({ ok: true, email: user.email });
});

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default router;
