// Pépites : des idées courtes à lire en 1 minute (façon Deepstash), 100 %
// gratuites et locales. Améliorations par rapport à une simple appli de
// cartes : fil personnalisé selon tes domaines les moins travaillés, révision
// espacée des idées sauvegardées, et transformation d'une idée en habitude ou
// en objectif en un clic. Les cartes du catalogue sont rédigées pour l'app
// (paraphrases, pas de citations longues) — `data/pepites.json` est librement
// enrichissable.
import { Router } from 'express';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../../middleware/auth.js';
import { db, DOMAINS } from '../../db.js';
import { extractiveSummary } from '../../shared/textTools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pepites.json'), 'utf-8'));

// Intervalles de révision (jours) : J1 → J3 → J7 → J14 → J30 → maîtrisée.
const REVIEW_STEPS = [1, 3, 7, 14, 30];

const router = Router();
router.use(requireAuth);

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Petit hash déterministe : même pépite du jour pour un utilisateur donné,
// différente d'un utilisateur à l'autre et d'un jour à l'autre.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function userCustom(uid) {
  return db.data.pepiteCustom.filter(c => c.userId === uid).map(c => ({ ...c, custom: true }));
}
function allPepites(uid) {
  return [...CATALOG, ...userCustom(uid)];
}
function findPepite(uid, id) {
  return allPepites(uid).find(p => p.id === id);
}
function savesOf(uid) {
  return db.data.pepiteSaves.filter(s => s.userId === uid);
}
function seenSet(uid) {
  return new Set(db.data.pepiteViews.filter(v => v.userId === uid).map(v => v.pepiteId));
}

// Domaines les moins travaillés : peu d'habitudes faites / objectifs actifs
// dans ce domaine sur 14 jours. Simple comptage d'activité, pas un diagnostic.
function weakDomains(uid) {
  const since = addDays(-14);
  const score = Object.fromEntries(DOMAINS.map(d => [d, 0]));
  for (const h of db.data.habits.filter(h => h.userId === uid)) {
    if (score[h.domain] == null) continue;
    score[h.domain] += 1 + (h.doneDates || []).filter(d => d >= since).length;
  }
  for (const g of db.data.goals.filter(g => g.userId === uid && g.status === 'active')) {
    if (score[g.category] != null) score[g.category] += 2;
  }
  return Object.entries(score).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([d]) => d);
}

// Pépites ajoutées ces 7 derniers jours (champ `addedAt`) : badge « Nouveau »
// et pseudo-thème « Nouveautés », pour que les ajouts réguliers se voient.
const NEW_THEME = '__new';
const NEW_DAYS = 7;
const isNew = (p) => !!p.addedAt && p.addedAt >= addDays(-NEW_DAYS);

function decorate(uid, p) {
  const save = savesOf(uid).find(s => s.pepiteId === p.id);
  return { ...p, isNew: isNew(p), saved: !!save, stash: save?.stash || null, saveId: save?.id || null };
}

// Fil : les pépites non lues d'abord, en mettant en avant tes domaines les
// moins travaillés, ordre mélangé mais stable sur la journée.
router.get('/feed', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const { domain, theme } = req.query;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const seen = seenSet(uid);
  const weak = weakDomains(uid);
  const day = today();

  let list = allPepites(uid);
  if (domain && domain !== 'all') list = list.filter(p => p.domain === domain);
  if (theme === NEW_THEME) list = list.filter(isNew);
  else if (theme) list = list.filter(p => p.theme === theme);

  const ranked = list
    .map(p => ({
      p,
      rank: (seen.has(p.id) ? 1000 : 0) - (weak.includes(p.domain) ? 100 : 0) + (hash(uid + day + p.id) % 100)
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(r => ({ ...decorate(uid, r.p), seen: seen.has(r.p.id) }));

  res.json({
    items: ranked,
    focusDomains: (domain && domain !== 'all') || theme ? [] : weak,
    total: list.length,
    unseen: list.filter(p => !seen.has(p.id)).length
  });
});

router.get('/daily', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const seen = seenSet(uid);
  const pool = CATALOG.filter(p => !seen.has(p.id));
  const source = pool.length ? pool : CATALOG;
  const p = source[hash(uid + today()) % source.length];
  res.json(decorate(uid, p));
});

router.get('/domains', (req, res) => {
  const counts = {};
  for (const p of CATALOG) counts[p.domain] = (counts[p.domain] || 0) + 1;
  res.json(DOMAINS.map(d => ({ domain: d, count: counts[d] || 0 })));
});

// Thèmes transversaux (Écouter sans juger, Couple, Santé mentale...).
router.get('/themes', (req, res) => {
  const counts = {};
  for (const p of CATALOG) if (p.theme) counts[p.theme] = (counts[p.theme] || 0) + 1;
  const themes = Object.entries(counts).map(([theme, count]) => ({ theme, label: theme, count }));
  const fresh = CATALOG.filter(isNew).length;
  if (fresh) themes.unshift({ theme: NEW_THEME, label: '🆕 Nouveautés', count: fresh });
  res.json(themes);
});

// Statistiques de lecture : idées lues, série de jours, idées à réviser.
router.get('/stats', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const views = db.data.pepiteViews.filter(v => v.userId === uid);
  const days = new Set(views.map(v => v.date));
  // La série reste valable tant qu'on a lu hier, même si pas encore aujourd'hui.
  let streak = 0;
  for (let i = days.has(today()) ? 0 : 1; days.has(addDays(-i)); i++) streak++;
  const saves = savesOf(uid);
  res.json({
    read: views.length,
    readToday: views.filter(v => v.date === today()).length,
    streak,
    saved: saves.length,
    dueReview: saves.filter(s => !s.mastered && s.nextReview <= today()).length,
    mastered: saves.filter(s => s.mastered).length
  });
});

// Marque une pépite comme lue (idempotent).
router.post('/:id/seen', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  if (!findPepite(uid, req.params.id)) return res.status(404).json({ error: 'Pépite introuvable.' });
  if (!db.data.pepiteViews.some(v => v.userId === uid && v.pepiteId === req.params.id)) {
    db.data.pepiteViews.push({ id: nanoid(), userId: uid, pepiteId: req.params.id, date: today(), createdAt: new Date().toISOString() });
    await db.write();
  }
  res.json({ ok: true });
});

// Sauvegarde dans une collection ("stash"). Re-sauvegarder change juste la collection.
router.post('/:id/save', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  if (!findPepite(uid, req.params.id)) return res.status(404).json({ error: 'Pépite introuvable.' });
  const stash = (req.body.stash || '').trim().slice(0, 40) || 'Favoris';
  let save = savesOf(uid).find(s => s.pepiteId === req.params.id);
  if (save) {
    save.stash = stash;
  } else {
    save = {
      id: nanoid(), userId: uid, pepiteId: req.params.id, stash,
      stage: 0, nextReview: addDays(REVIEW_STEPS[0]), mastered: false,
      savedAt: new Date().toISOString()
    };
    db.data.pepiteSaves.push(save);
  }
  await db.write();
  res.status(201).json(save);
});

router.delete('/saves/:saveId', async (req, res) => {
  await db.read();
  const before = db.data.pepiteSaves.length;
  db.data.pepiteSaves = db.data.pepiteSaves.filter(s => !(s.id === req.params.saveId && s.userId === req.user.id));
  if (db.data.pepiteSaves.length === before) return res.status(404).json({ error: 'Sauvegarde introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// Collections avec leurs pépites.
router.get('/stashes', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const groups = {};
  for (const s of savesOf(uid)) {
    const p = findPepite(uid, s.pepiteId);
    if (!p) continue;
    (groups[s.stash] ||= []).push({ ...p, saveId: s.id, stash: s.stash, mastered: s.mastered, nextReview: s.nextReview });
  }
  res.json(Object.entries(groups).map(([name, items]) => ({ name, items })));
});

// Révision espacée : les pépites sauvegardées dont la date est arrivée.
router.get('/review', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const due = savesOf(uid)
    .filter(s => !s.mastered && s.nextReview <= today())
    .map(s => ({ save: s, pepite: findPepite(uid, s.pepiteId) }))
    .filter(x => x.pepite);
  res.json(due.map(({ save, pepite }) => ({ ...pepite, saveId: save.id, stage: save.stage })));
});

// remembered=true → étape suivante ; false → on recommence à J1.
router.post('/saves/:saveId/review', async (req, res) => {
  await db.read();
  const save = db.data.pepiteSaves.find(s => s.id === req.params.saveId && s.userId === req.user.id);
  if (!save) return res.status(404).json({ error: 'Sauvegarde introuvable.' });
  if (req.body.remembered) {
    save.stage += 1;
    if (save.stage >= REVIEW_STEPS.length) { save.mastered = true; save.nextReview = null; }
    else save.nextReview = addDays(REVIEW_STEPS[save.stage]);
  } else {
    save.stage = 0;
    save.nextReview = addDays(REVIEW_STEPS[0]);
  }
  save.lastReviewedAt = new Date().toISOString();
  await db.write();
  res.json(save);
});

// Passer à l'action : transforme l'action de la pépite en habitude ou objectif.
router.post('/:id/apply', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const p = findPepite(uid, req.params.id);
  if (!p) return res.status(404).json({ error: 'Pépite introuvable.' });
  const as = req.body.as === 'goal' ? 'goal' : 'habit';
  const title = (req.body.title || p.action || p.title).trim().slice(0, 200);
  const domain = DOMAINS.includes(p.domain) ? p.domain : 'mental';
  const now = new Date().toISOString();
  let created;
  if (as === 'habit') {
    created = { id: nanoid(), userId: uid, title, frequency: 'daily', domain, doneDates: [], createdAt: now, fromPepite: p.id };
    db.data.habits.push(created);
  } else {
    created = { id: nanoid(), userId: uid, title, category: domain, status: 'active', createdAt: now, fromPepite: p.id };
    db.data.goals.push(created);
  }
  await db.write();
  res.status(201).json({ as, item: created });
});

// Crée ta propre pépite (ce que tu as lu, entendu, compris).
router.post('/custom', async (req, res) => {
  const { title, text, domain, source, action } = req.body;
  if (!title?.trim() || !text?.trim()) return res.status(400).json({ error: 'Titre et texte requis.' });
  await db.read();
  const p = {
    id: 'c_' + nanoid(), userId: req.user.id,
    title: title.trim().slice(0, 120), text: text.trim().slice(0, 1200),
    domain: DOMAINS.includes(domain) ? domain : 'mental',
    source: (source || '').trim().slice(0, 160) || 'Ma pépite',
    action: (action || '').trim().slice(0, 200),
    createdAt: new Date().toISOString()
  };
  db.data.pepiteCustom.push(p);
  await db.write();
  res.status(201).json(p);
});

router.delete('/custom/:id', async (req, res) => {
  await db.read();
  const uid = req.user.id;
  const before = db.data.pepiteCustom.length;
  db.data.pepiteCustom = db.data.pepiteCustom.filter(c => !(c.id === req.params.id && c.userId === uid));
  if (db.data.pepiteCustom.length === before) return res.status(404).json({ error: 'Pépite introuvable.' });
  db.data.pepiteSaves = db.data.pepiteSaves.filter(s => !(s.userId === uid && s.pepiteId === req.params.id));
  db.data.pepiteViews = db.data.pepiteViews.filter(v => !(v.userId === uid && v.pepiteId === req.params.id));
  await db.write();
  res.json({ ok: true });
});

// Extrait des pépites d'un livre de ta bibliothèque (résumé extractif local) :
// renvoie des brouillons à relire, rien n'est enregistré automatiquement.
router.get('/from-library/:bookId', async (req, res) => {
  await db.read();
  const book = db.data.libraryItems.find(b => b.id === req.params.bookId && b.userId === req.user.id);
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  const sentences = extractiveSummary(book.text || '', 5);
  res.json(sentences.map((s, i) => ({
    title: `${book.title} — idée ${i + 1}`,
    text: s,
    source: book.author ? `${book.title} — ${book.author}` : book.title
  })));
});

export default router;
