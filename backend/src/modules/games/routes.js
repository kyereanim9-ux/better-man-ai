// Jeux bibliques : les jeux eux-mêmes tournent dans le navigateur ; le serveur
// fournit le texte (passage choisi, versets en mémorisation, listes de
// révision), les questions préparées (data/content.json, citations vérifiées
// sur la Louis Segond), les scores et les défis entre utilisateurs.
// Un défi garde le jeu, la source et une « graine » : tous les joueurs du défi
// reçoivent les mêmes versets dans le même ordre, donc les scores se comparent.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import * as lsg from '../bible/lsg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'content.json'), 'utf-8'));

const router = Router();
router.use(requireAuth);

export const GAMES = ['order', 'reference', 'blanks', 'memory', 'hangman', 'wordsearch', 'anagram', 'truefalse', 'trivia', 'quotes', 'riddles', 'adventure'];

// Générateur pseudo-aléatoire reproductible (mulberry32).
function seeded(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Source → libellé + versets ({ ref, text }).
async function resolvePool(q, uid) {
  const count = Math.min(Math.max(Number(q.count) || 30, 5), 60);
  const rng = seeded(q.seed || Date.now());
  const int = (v) => (v === undefined || v === '' || v === null ? null : Number(v));
  switch (q.source) {
    case 'mine': {
      const items = db.data.bibleMemorization.filter(m => m.userId === uid).map(m => ({ ref: m.ref, text: m.text }));
      if (!items.length) throw new Error('Tu n\'as pas encore de verset en mémorisation : ajoute-en dans Bible, ou choisis un passage.');
      return { label: 'Mes versets', verses: items };
    }
    case 'study': {
      const set = db.data.studySets.find(s => s.id === q.set && ((s.visibility || 'all') === 'all' || s.ownerId === uid));
      if (!set) throw new Error('Liste de révision introuvable.');
      const items = set.items.filter(i => i.a).map(i => ({ ref: i.q, text: i.a }));
      if (!items.length) throw new Error('Cette liste n\'a pas encore de réponses.');
      return { label: set.title, verses: items, cards: true };
    }
    case 'book':
    case 'chapter': {
      const b = int(q.book);
      const book = lsg.books()[b];
      if (!book) throw new Error('Livre inconnu.');
      if (q.source === 'book') return { label: book.name, verses: lsg.pickVerses({ book: b, count, rng }) };
      const c = int(q.chapter);
      if (!c || c > book.chapters) throw new Error(`${book.name} a ${book.chapters} chapitre(s).`);
      const from = int(q.from), to = int(q.to);
      const verses = lsg.pickVerses({ book: b, chapter: c, from, to, count: 200, rng });
      if (!verses.length) throw new Error('Aucun verset dans cette plage.');
      const label = from ? `${book.name} ${c}:${from}${to && to !== from ? '-' + to : ''}` : `${book.name} ${c}`;
      return { label, verses };
    }
    default:
      return { label: 'Toute la Bible', verses: lsg.pickVerses({ count, rng }) };
  }
}

router.get('/pool', async (req, res) => {
  await db.read();
  try { res.json(await resolvePool(req.query, req.user.id)); } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/content', (req, res) => res.json(CONTENT));

// --- Scores ---
router.post('/scores', async (req, res) => {
  const { game, score, max, label, challenge } = req.body;
  if (!GAMES.includes(game)) return res.status(400).json({ error: 'Jeu inconnu.' });
  const s = Math.max(0, Math.round(Number(score) || 0));
  const m = Math.max(1, Math.round(Number(max) || 1));
  if (s > m * 10) return res.status(400).json({ error: 'Score invalide.' });
  await db.read();
  const ch = challenge ? db.data.gameChallenges.find(c => c.id === challenge) : null;
  const entry = { id: nanoid(), userId: req.user.id, game, score: s, max: m, label: String(label || '').slice(0, 80), challengeId: ch?.id || null, createdAt: new Date().toISOString() };
  db.data.gameScores.push(entry);
  // Garde au plus 200 scores par personne (les plus récents).
  const mine = db.data.gameScores.filter(x => x.userId === req.user.id);
  if (mine.length > 200) {
    const drop = new Set(mine.slice(0, mine.length - 200).map(x => x.id));
    db.data.gameScores = db.data.gameScores.filter(x => !drop.has(x.id));
  }
  await db.write();
  const best = Math.max(...db.data.gameScores.filter(x => x.userId === req.user.id && x.game === game && !x.challengeId).map(x => x.score), 0);
  res.json({ ok: true, best, record: !ch && s >= best });
});

const firstName = (uid) => (db.data.users.find(u => u.id === uid)?.name || 'Joueur').trim().split(' ')[0];
function ranking(scores, uid) {
  const best = new Map();
  for (const s of scores) if (!best.has(s.userId) || s.score > best.get(s.userId).score) best.set(s.userId, s);
  return [...best.values()].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt)).slice(0, 10)
    .map(s => ({ name: firstName(s.userId), score: s.score, max: s.max, me: s.userId === uid }));
}

// Classement général d'un jeu (meilleur score de chacun, hors défis).
router.get('/leaderboard', async (req, res) => {
  await db.read();
  res.json(ranking(db.data.gameScores.filter(s => s.game === req.query.game && !s.challengeId), req.user.id));
});

// --- Défis : même partie pour tous, visibles par tous les utilisateurs ---
router.post('/challenges', async (req, res) => {
  const { game, config, label } = req.body;
  if (!GAMES.includes(game)) return res.status(400).json({ error: 'Jeu inconnu.' });
  await db.read();
  const ch = {
    id: nanoid(10), game, label: String(label || '').slice(0, 80), userId: req.user.id,
    config: { ...(config || {}), seed: Math.floor(Math.random() * 2 ** 31) },
    createdAt: new Date().toISOString()
  };
  db.data.gameChallenges.push(ch);
  db.data.gameChallenges = db.data.gameChallenges.slice(-300);
  await db.write();
  res.status(201).json(ch);
});

router.get('/challenges', async (req, res) => {
  await db.read();
  const list = db.data.gameChallenges.slice(-30).reverse().map(ch => {
    const scores = db.data.gameScores.filter(s => s.challengeId === ch.id);
    return { ...ch, by: firstName(ch.userId), players: new Set(scores.map(s => s.userId)).size, played: scores.some(s => s.userId === req.user.id), top: ranking(scores, req.user.id)[0] || null };
  });
  res.json(list);
});

router.get('/challenges/:id', async (req, res) => {
  await db.read();
  const ch = db.data.gameChallenges.find(c => c.id === req.params.id);
  if (!ch) return res.status(404).json({ error: 'Défi introuvable.' });
  res.json({ ...ch, by: firstName(ch.userId), ranking: ranking(db.data.gameScores.filter(s => s.challengeId === ch.id), req.user.id) });
});

export default router;
