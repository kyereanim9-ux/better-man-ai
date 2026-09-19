import jwt from 'jsonwebtoken';
import { db } from '../db.js';

// Vérifie le token JWT ET que le compte existe toujours et est actif.
// Sans cette seconde vérification, un compte supprimé ou désactivé garderait
// un token utilisable jusqu'à son expiration (30 jours) — inacceptable pour
// une fonctionnalité de suppression de compte.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }

  await db.read();
  const user = db.data.users.find(u => u.id === payload.id);
  if (!user) return res.status(401).json({ error: 'Ce compte n\'existe plus.' });
  if (!user.active) return res.status(403).json({ error: 'Ce compte a été désactivé.' });

  // Le rôle vient toujours de la base (pas du token) pour qu'un changement de
  // rôle par un admin prenne effet immédiatement, sans attendre l'expiration du token.
  req.user = { id: user.id, role: user.role, email: user.email };
  next();
}

// À utiliser après requireAuth. Bloque tout ce qui n'est pas admin.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
  }
  next();
}
