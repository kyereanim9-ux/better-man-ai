// Révisions : listes de questions/réponses à apprendre pour un test (ex. les
// titres des chapitres de l'Apocalypse). Une liste se colle d'un bloc (une
// ligne = « question | réponse »). Par défaut elle est visible par tous les
// utilisateurs de l'app (ou privée), et chacun a sa propre progression
// (boîtes de Leitner : une carte sue revient de plus en plus tard, une carte
// ratée revient tout de suite). Les listes de data/builtin.json sont créées
// automatiquement pour tout le monde ; les admins peuvent les modifier.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'builtin.json'), 'utf-8'));

const router = Router();
router.use(requireAuth);

const MAX_ITEMS = 500;
// Délai (jours) avant de revoir une carte selon sa boîte, 0 = à revoir aujourd'hui.
const BOX_DAYS = [0, 1, 2, 4, 7, 14];
export const MASTERED_BOX = 4;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const daysUntil = (date) => date ? Math.round((Date.parse(date) - Date.parse(today())) / 86400000) : null;

// Séparateur : « | », tabulation, « = », tiret long, « - » entouré d'espaces,
// ou « : » qui ne sépare pas deux chiffres (« Apocalypse 1:5 » reste entier).
const SEPARATOR = /\s*(?:\||\t|=|—|–|\s-\s|(?<!\d):(?!\d))\s*/;
export function parseItems(text, previous = []) {
  const byQuestion = new Map(previous.map(i => [i.q.toLowerCase(), i]));
  const items = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(SEPARATOR);
    const q = (m ? line.slice(0, m.index) : line).trim().slice(0, 300);
    const a = (m ? line.slice(m.index + m[0].length) : '').trim().slice(0, 600);
    if (!q) continue;
    // Même question qu'avant : on garde son id pour ne pas perdre la progression.
    const old = byQuestion.get(q.toLowerCase());
    items.push({ id: old?.id || nanoid(8), q, a });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

// Ajoute une seule fois les listes fournies avec l'app (supprimées = pas recréées).
function ensureBuiltin() {
  const seeded = db.data.appConfig.studySeeded || (db.data.appConfig.studySeeded = []);
  let changed = false;
  for (const b of BUILTIN) {
    if (seeded.includes(b.id)) continue;
    const now = new Date().toISOString();
    if (!db.data.studySets.some(s => s.id === b.id)) {
      db.data.studySets.push({ id: b.id, ownerId: null, title: b.title, description: b.description || '', examDate: null, visibility: 'all', items: b.items, createdAt: now, updatedAt: now });
    }
    seeded.push(b.id);
    changed = true;
  }
  return changed;
}

const isPublic = (set) => (set.visibility || 'all') === 'all';
function canAccess(set, uid) {
  return isPublic(set) || set.ownerId === uid || db.data.studyMembers.some(m => m.setId === set.id && m.userId === uid);
}
// Le créateur modifie sa liste ; un admin peut modifier les listes publiques.
function canEdit(set, user) {
  return set.ownerId === user.id || (user.role === 'admin' && isPublic(set));
}
function findSet(req, res) {
  const set = db.data.studySets.find(s => s.id === req.params.id);
  if (!set || !canAccess(set, req.user.id)) { res.status(404).json({ error: 'Liste introuvable.' }); return null; }
  return set;
}

function progressOf(uid, set) {
  const mine = new Map(db.data.studyProgress.filter(p => p.userId === uid && p.setId === set.id).map(p => [p.itemId, p]));
  return set.items.map(i => mine.get(i.id) || null);
}
function summary(set, uid, role) {
  const ready = set.items.filter(i => i.a);
  const progress = new Map(db.data.studyProgress.filter(p => p.userId === uid && p.setId === set.id).map(p => [p.itemId, p]));
  const t = today();
  const mastered = ready.filter(i => (progress.get(i.id)?.box || 0) >= MASTERED_BOX).length;
  const due = ready.filter(i => { const p = progress.get(i.id); return !p || p.due <= t; }).length;
  return {
    id: set.id, title: set.title, description: set.description, examDate: set.examDate, daysLeft: daysUntil(set.examDate),
    isOwner: set.ownerId === uid, canEdit: canEdit(set, { id: uid, role }), visibility: set.visibility || 'all',
    owner: set.ownerId ? (db.data.users.find(u => u.id === set.ownerId)?.name || '') : 'Better Man AI',
    total: ready.length, incomplete: set.items.length - ready.length, mastered, due,
    learners: new Set(db.data.studyProgress.filter(p => p.setId === set.id).map(p => p.userId)).size, updatedAt: set.updatedAt
  };
}

// Nombre de cartes à revoir aujourd'hui, toutes listes confondues (rappels).
// Seulement les listes que la personne a créées ou déjà commencé à réviser.
export function studyDue(uid) {
  const started = new Set(db.data.studyProgress.filter(p => p.userId === uid).map(p => p.setId));
  return db.data.studySets.filter(s => canAccess(s, uid) && (s.ownerId === uid || started.has(s.id)))
    .map(s => ({ title: s.title, due: summary(s, uid).due })).filter(s => s.due > 0);
}

function cleanMeta(body, current = {}) {
  const title = String(body.title ?? current.title ?? '').trim().slice(0, 120);
  const description = String(body.description ?? current.description ?? '').trim().slice(0, 500);
  const examDate = /^\d{4}-\d{2}-\d{2}$/.test(body.examDate) ? body.examDate : (body.examDate === '' ? null : current.examDate || null);
  const visibility = ['all', 'private'].includes(body.visibility) ? body.visibility : (current.visibility || 'all');
  return { title, description, examDate, visibility };
}

router.get('/', async (req, res) => {
  await db.read();
  if (ensureBuiltin()) await db.write();
  const uid = req.user.id;
  const sets = db.data.studySets.filter(s => canAccess(s, uid)).map(s => summary(s, uid, req.user.role));
  sets.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  res.json(sets);
});

router.post('/', async (req, res) => {
  await db.read();
  const meta = cleanMeta(req.body);
  if (!meta.title) return res.status(400).json({ error: 'Donne un titre à ta liste.' });
  const items = parseItems(req.body.text);
  if (!items.length) return res.status(400).json({ error: 'Ajoute au moins une ligne « question | réponse ».' });
  const now = new Date().toISOString();
  const set = { id: nanoid(), ownerId: req.user.id, ...meta, items, createdAt: now, updatedAt: now };
  db.data.studySets.push(set);
  await db.write();
  res.status(201).json(summary(set, req.user.id, req.user.role));
});

router.get('/:id', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  const progress = progressOf(req.user.id, set);
  res.json({
    ...summary(set, req.user.id, req.user.role),
    items: set.items.map((i, k) => ({
      ...i, box: progress[k]?.box || 0, due: progress[k]?.due || null,
      right: progress[k]?.right || 0, wrong: progress[k]?.wrong || 0, tip: progress[k]?.tip || ''
    }))
  });
});

// Classement : prénom et part des cartes maîtrisées de chaque personne qui
// révise cette liste (et de son créateur).
router.get('/:id/group', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  const ids = [...new Set([set.ownerId, req.user.id, ...db.data.studyProgress.filter(p => p.setId === set.id).map(p => p.userId)])]
    .filter(uid => uid && db.data.users.some(u => u.id === uid && u.active));
  const ready = set.items.filter(i => i.a).length || 1;
  const rows = ids.map(uid => {
    const user = db.data.users.find(u => u.id === uid);
    const mastered = summary(set, uid).mastered;
    return { name: (user?.name || 'Membre').split(' ')[0], mastered, percent: Math.round(mastered * 100 / ready), me: uid === req.user.id };
  }).sort((a, b) => b.mastered - a.mastered);
  res.json(rows);
});

router.put('/:id', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  if (!canEdit(set, req.user)) return res.status(403).json({ error: 'Seule la personne qui a créé la liste peut la modifier.' });
  const meta = cleanMeta(req.body, set);
  if (!meta.title) return res.status(400).json({ error: 'Donne un titre à ta liste.' });
  if (req.body.text !== undefined) {
    const items = parseItems(req.body.text, set.items);
    if (!items.length) return res.status(400).json({ error: 'Ajoute au moins une ligne « question | réponse ».' });
    const keep = new Set(items.map(i => i.id));
    db.data.studyProgress = db.data.studyProgress.filter(p => p.setId !== set.id || keep.has(p.itemId));
    set.items = items;
  }
  Object.assign(set, meta, { updatedAt: new Date().toISOString() });
  await db.write();
  res.json(summary(set, req.user.id, req.user.role));
});

// Créateur (ou admin) : supprime la liste pour tout le monde. Sinon : remet sa
// progression à zéro et quitte la liste si elle était partagée par code.
router.delete('/:id', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  const uid = req.user.id;
  if (canEdit(set, req.user)) {
    db.data.studySets = db.data.studySets.filter(s => s.id !== set.id);
    db.data.studyMembers = db.data.studyMembers.filter(m => m.setId !== set.id);
    db.data.studyProgress = db.data.studyProgress.filter(p => p.setId !== set.id);
  } else {
    db.data.studyMembers = db.data.studyMembers.filter(m => !(m.setId === set.id && m.userId === uid));
    db.data.studyProgress = db.data.studyProgress.filter(p => !(p.setId === set.id && p.userId === uid));
  }
  await db.write();
  res.json({ ok: true });
});

function progressRow(uid, set, itemId) {
  let p = db.data.studyProgress.find(x => x.userId === uid && x.setId === set.id && x.itemId === itemId);
  if (!p) {
    p = { id: nanoid(), userId: uid, setId: set.id, itemId, box: 0, due: today(), right: 0, wrong: 0, tip: '', lastAt: null };
    db.data.studyProgress.push(p);
  }
  return p;
}

// Résultat d'une ou plusieurs cartes : { results: [{ itemId, correct }] }.
router.post('/:id/review', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  const results = Array.isArray(req.body.results) ? req.body.results.slice(0, MAX_ITEMS) : [];
  const left = daysUntil(set.examDate);
  for (const r of results) {
    if (!set.items.some(i => i.id === r.itemId)) continue;
    const p = progressRow(req.user.id, set, r.itemId);
    if (r.correct) {
      p.box = Math.min(p.box + 1, BOX_DAYS.length - 1);
      p.right++;
      // Avant le test, une carte revient au plus tard la veille.
      const days = left !== null && left > 1 ? Math.min(BOX_DAYS[p.box], left - 1) : BOX_DAYS[p.box];
      p.due = addDays(today(), Math.max(days, 1));
    } else {
      p.box = 0;
      p.wrong++;
      p.due = today();
    }
    p.lastAt = new Date().toISOString();
  }
  await db.write();
  res.json(summary(set, req.user.id, req.user.role));
});

// Astuce personnelle (moyen mnémotechnique) pour une carte.
router.patch('/:id/items/:itemId/tip', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  if (!set.items.some(i => i.id === req.params.itemId)) return res.status(404).json({ error: 'Carte introuvable.' });
  progressRow(req.user.id, set, req.params.itemId).tip = String(req.body.tip || '').trim().slice(0, 300);
  await db.write();
  res.json({ ok: true });
});

router.post('/:id/reset', async (req, res) => {
  await db.read();
  const set = findSet(req, res);
  if (!set) return;
  db.data.studyProgress = db.data.studyProgress.filter(p => !(p.setId === set.id && p.userId === req.user.id));
  await db.write();
  res.json(summary(set, req.user.id, req.user.role));
});

export default router;
