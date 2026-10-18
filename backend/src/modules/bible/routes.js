import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { computeStatus, advanceStage, STAGES } from './spacedRepetition.js';
import { stripAccents } from '../../shared/textNormalize.js';
import * as lsg from './lsg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verses = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'verses.json'), 'utf-8'));

const router = Router();
router.use(requireAuth);

// Dictionnaire simple mot-clé -> thème, pour /ask et /search.
const KEYWORD_TO_THEME = {
  colère: 'colère', énervé: 'colère', fâché: 'colère',
  pardon: 'pardon', pardonner: 'pardon',
  patience: 'patience', impatient: 'patience',
  amour: 'amour', aimer: 'amour',
  peur: 'peur', anxieux: 'peur', inquiet: 'peur', anxiété: 'peur',
  argent: 'finances', finance: 'finances', finances: 'finances', budget: 'finances',
  travail: 'travail', boulot: 'travail', carrière: 'professionnel',
  conflit: 'conflit', dispute: 'conflit', désaccord: 'conflit',
  relation: 'relationnel', couple: 'relationnel', copine: 'relationnel', copain: 'relationnel',
  communication: 'communication', parler: 'communication', écouter: 'communication',
  discipline: 'discipline', habitude: 'discipline',
  confiance: 'confiance',
  intime: 'intime', intimité: 'intime', sexualité: 'intime',
  mental: 'mental', pensée: 'mental',
  encouragement: 'encouragement', découragé: 'encouragement'
};

// Choix déterministe basé sur la date (même verset toute la journée, pour tout le monde).
function pickForToday(list, salt = 0) {
  const today = new Date().toISOString().slice(0, 10);
  let hash = salt;
  for (const ch of today) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return list[hash % list.length];
}

// Exporté pour les notifications (même verset que l'onglet Bible).
export const verseOfDay = () => pickForToday(verses, 1);

router.get('/verse-of-day', (req, res) => {
  res.json({ verse: verseOfDay() });
});

router.get('/reading-of-day', (req, res) => {
  // "Lecture du jour" : un passage différent du verset du jour (salt différent).
  res.json({ verse: pickForToday(verses, 7) });
});

router.get('/question-of-day', (req, res) => {
  const verse = pickForToday(verses, 1);
  res.json({
    verse,
    question: `En repensant à ${verse.ref}, où vois-tu ce principe (ou son absence) dans ta journée d'hier ?`
  });
});

// Recherche par thème ou texte libre.
router.get('/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const qNorm = stripAccents(q);
  const theme = KEYWORD_TO_THEME[q] || KEYWORD_TO_THEME[qNorm] || q;
  const themeNorm = stripAccents(theme);
  const results = verses.filter(v =>
    v.themes.some(t => stripAccents(t).includes(themeNorm) || themeNorm.includes(stripAccents(t))) ||
    stripAccents(v.text.toLowerCase()).includes(qNorm) ||
    stripAccents(v.ref.toLowerCase()).includes(qNorm)
  );
  res.json(results);
});

// "Que dit la Bible sur X ?" — distingue explicitement TEXTE vs APPLICATION.
router.post('/ask', (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question vide.' });

  const lowerNorm = stripAccents(question.toLowerCase());
  const matchedKeyword = Object.keys(KEYWORD_TO_THEME).find(k => lowerNorm.includes(stripAccents(k)));
  const theme = matchedKeyword ? KEYWORD_TO_THEME[matchedKeyword] : null;

  const matches = theme
    ? verses.filter(v => v.themes.includes(theme)).slice(0, 5)
    : [];

  res.json({
    question,
    texteBiblique: matches.map(v => ({ ref: v.ref, text: v.text })),
    application: matches.length
      ? "Ceci est une INTERPRÉTATION possible, pas une réponse directe à ta situation précise : " +
        "ces passages abordent le thème détecté. Demande-toi ce que ce principe change concrètement " +
        "pour toi aujourd'hui, plutôt que de l'appliquer mécaniquement."
      : "Aucun passage n'a été trouvé automatiquement pour cette question dans la bibliothèque actuelle. " +
        "Essaie une recherche par thème (ex : colère, pardon, patience, finances, relations)."
  });
});

// --- BIBLE COMPLÈTE (Louis Segond 1910) : recherche, lecture par chapitre ---

router.get('/books', (req, res) => res.json(lsg.books()));

// Une référence (« Jean 3:16 », « Ps 23 ») ou des mots-clés (« paix », « pardonne offenses »).
router.get('/lookup', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: 'Écris une référence ou un mot à chercher.' });
  const ref = lsg.parseReference(q);
  if (ref?.error) return res.status(404).json({ error: ref.error });
  if (ref) {
    const ch = lsg.chapter(ref.b, ref.c);
    const verses = ref.from === null ? ch.verses : ch.verses.slice(ref.from - 1, ref.to);
    return res.json({ type: 'ref', book: ch.book, bookIndex: ch.bookIndex, chapter: ch.chapter, chapters: ch.chapters, verses });
  }
  const { total, results } = lsg.searchText(q, 50);
  res.json({ type: 'search', total, results });
});

router.get('/chapter', (req, res) => {
  const ch = lsg.chapter(Number(req.query.book), Number(req.query.chapter));
  if (!ch) return res.status(404).json({ error: 'Chapitre introuvable.' });
  res.json(ch);
});

// Quiz à trous. ?source=mine pioche dans les versets en mémorisation de
// l'utilisateur (repli sur toute la bibliothèque s'il n'en a pas).
// La réponse n'est pas envoyée : elle est vérifiée par POST /quiz/check.
function quizWords(text) { return text.split(' '); }
const cleanWord = (w) => w.replace(/[.,;:!?«»"()]/g, '');
// Comparaison tolérante : sans accents, majuscules ni ponctuation.
function normalizeAnswer(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');
}
// Mots trop courants pour faire un bon trou à retrouver.
const QUIZ_SKIP = new Set(['vous', 'nous', 'dans', 'pour', 'avec', 'mais', 'elle', 'elles', 'leur', 'leurs', 'sont', 'votre', 'notre', 'cette', 'tout', 'toute', 'tous', 'celui', 'ceux', 'point', 'comme', 'aussi', 'ainsi']);
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

router.get('/quiz', async (req, res) => {
  let pool = verses;
  let source = 'all';
  if (req.query.source === 'bible') { pool = [lsg.randomVerse()]; source = 'bible'; }
  if (req.query.source === 'mine') {
    await db.read();
    const mine = db.data.bibleMemorization.filter(m => m.userId === req.user.id).map(m => ({ ref: m.ref, text: m.text }));
    if (mine.length) { pool = mine; source = 'mine'; }
  }
  const verse = pool[Math.floor(Math.random() * pool.length)];
  const words = quizWords(verse.text);
  // Choisit un mot significatif (plus de 3 lettres) à retirer.
  const candidateIndexes = words.map((w, i) => i)
    .filter(i => cleanWord(words[i]).length > 3 && !QUIZ_SKIP.has(normalizeAnswer(words[i])))
    // Toute la Bible : on évite les noms propres (Akisch, Jizreel…), peu utiles à apprendre.
    .filter(i => source !== 'bible' || !/^(?:[a-zà-ÿ][’'])?[A-ZÀ-Ý]/.test(words[i]));
  const blankIndex = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)] ?? 0;
  const answer = cleanWord(words[blankIndex]);
  const prompt = words.map((w, i) => (i === blankIndex ? w.replace(answer, '_____') : w)).join(' ');

  res.json({ ref: verse.ref, prompt, blankIndex, answerLength: answer.length, hint: answer.charAt(0), source });
});

router.post('/quiz/check', async (req, res) => {
  const { ref, blankIndex, answer, reveal } = req.body;
  let verse = verses.find(v => v.ref === ref);
  if (!verse) {
    await db.read();
    verse = db.data.bibleMemorization.find(m => m.userId === req.user.id && m.ref === ref) || lsg.passage(ref);
  }
  if (!verse) return res.status(404).json({ error: 'Verset introuvable.' });
  const words = quizWords(verse.text);
  const expected = cleanWord(words[Number(blankIndex)] || '');
  if (!expected) return res.status(400).json({ error: 'Question invalide.' });

  const given = normalizeAnswer(answer);
  const target = normalizeAnswer(expected);
  // « l'Éternel » : accepte aussi « Éternel » sans l'article élidé.
  const exact = !reveal && (given === target || given === target.replace(/^[a-z]'/, ''));
  // Une petite faute de frappe est acceptée sur les mots de 5 lettres ou plus.
  const typo = !reveal && !exact && target.length >= 5 && editDistance(given, target) === 1;
  res.json({ correct: exact || typo, typo, expected, fullText: verse.text, ref: verse.ref });
});

// --- MÉMORISATION (répétition espacée) ---

router.get('/memorization', async (req, res) => {
  await db.read();
  const items = db.data.bibleMemorization
    .filter(m => m.userId === req.user.id)
    .map(computeStatus);
  res.json({
    stages: STAGES.filter(s => s.key !== 'mastered').map(s => s.label),
    mastered: items.filter(i => i.status === 'mastered'),
    inProgress: items.filter(i => i.status !== 'mastered' && !i.isDue),
    due: items.filter(i => i.isDue)
  });
});

router.post('/memorization', async (req, res) => {
  const { ref, text } = req.body;
  // Verset de la sélection, n'importe quel passage de la Bible (jusqu'à 10
  // versets), ou verset personnalisé (autre traduction) avec son texte.
  let verse = verses.find(v => v.ref === ref) || lsg.passage(ref);
  if (verse && verse.ref.includes('-')) {
    const [, from, to] = verse.ref.match(/:(\d+)-(\d+)$/) || [];
    if (from && Number(to) - Number(from) >= 10) return res.status(400).json({ error: 'Choisis au plus 10 versets à la fois.' });
  }
  if (!verse && ref?.trim() && text?.trim()) {
    verse = { ref: ref.trim().slice(0, 80), text: text.trim().slice(0, 1500), custom: true };
  }
  if (!verse) return res.status(404).json({ error: 'Verset introuvable. Vérifie la référence (ex : Jean 3:16) ou colle le texte du verset.' });

  await db.read();
  const already = db.data.bibleMemorization.find(m => m.userId === req.user.id && m.ref === verse.ref);
  if (already) return res.status(409).json({ error: 'Ce verset est déjà dans ta liste de mémorisation.' });

  const item = {
    id: nanoid(), userId: req.user.id, ref: verse.ref, text: verse.text,
    ...(verse.custom ? { custom: true } : {}),
    stage: 0, startedAt: new Date().toISOString()
  };
  db.data.bibleMemorization.push(item);
  await db.write();
  res.status(201).json(computeStatus(item));
});

router.post('/memorization/:id/advance', async (req, res) => {
  await db.read();
  const item = db.data.bibleMemorization.find(m => m.id === req.params.id && m.userId === req.user.id);
  if (!item) return res.status(404).json({ error: 'Verset introuvable.' });
  const updated = advanceStage(item);
  Object.assign(item, updated);
  await db.write();
  res.json(computeStatus(item));
});

router.delete('/memorization/:id', async (req, res) => {
  await db.read();
  const before = db.data.bibleMemorization.length;
  db.data.bibleMemorization = db.data.bibleMemorization.filter(
    m => !(m.id === req.params.id && m.userId === req.user.id)
  );
  if (db.data.bibleMemorization.length === before) return res.status(404).json({ error: 'Verset introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
