// Réinitialisation du mot de passe par lien à usage unique.
// Seule l'empreinte SHA-256 du jeton est gardée en base : le lien envoyé
// par email ne peut pas être reconstitué à partir de la base de données.
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '../../db.js';

export const RESET_TTL_MIN = 60;
const MAX_PER_HOUR = 3;

// Adresse publique de l'app pour les liens. Jamais déduite de l'en-tête Host
// de la requête : il pourrait être falsifié pour détourner le lien.
export const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'https://better-man-ai.vercel.app').replace(/\/+$/, '');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Crée un lien (appeler après db.read(), puis db.write()). null si trop de
// demandes récentes pour ce compte.
export function createResetLink(userId, { ignoreLimit = false } = {}) {
  const now = Date.now();
  const recent = db.data.passwordResets.filter(r => r.userId === userId && now - Date.parse(r.createdAt) < 3600000);
  if (!ignoreLimit && recent.length >= MAX_PER_HOUR) return null;
  // Un seul lien valable à la fois ; on oublie les très anciens.
  db.data.passwordResets = db.data.passwordResets.filter(r => r.userId !== userId && now - Date.parse(r.createdAt) < 86400000)
    .concat(recent.map(r => ({ ...r, usedAt: r.usedAt || new Date(now).toISOString() })));
  const token = crypto.randomBytes(32).toString('base64url');
  db.data.passwordResets.push({
    id: nanoid(), userId, tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESET_TTL_MIN * 60000).toISOString(),
    usedAt: null
  });
  return `${APP_PUBLIC_URL}/?reset=${token}`;
}

export function findValidReset(token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const hash = hashToken(token);
  const r = db.data.passwordResets.find(x => x.tokenHash === hash);
  if (!r || r.usedAt || Date.parse(r.expiresAt) < Date.now()) return null;
  return r;
}
