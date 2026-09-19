import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { computeStatus, advanceStage, STAGES } from './spacedRepetition.js';
import { stripAccents } from '../../shared/textNormalize.js';

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

router.get('/verse-of-day', (req, res) => {
  res.json({ verse: pickForToday(verses, 1) });
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

// Quiz simple à trous, généré à partir d'un verset.
router.get('/quiz', (req, res) => {
  const verse = verses[Math.floor(Math.random() * verses.length)];
  const words = verse.text.split(' ');
  // Choisit un mot significatif (plus de 3 lettres) à retirer.
  const candidateIndexes = words.map((w, i) => i).filter(i => words[i].replace(/[.,;:]/g, '').length > 3);
  const blankIndex = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)] ?? 0;
  const answer = words[blankIndex].replace(/[.,;:]/g, '');
  const prompt = words.map((w, i) => (i === blankIndex ? '_____' : w)).join(' ');

  res.json({ ref: verse.ref, prompt, answerLength: answer.length });
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
  const { ref } = req.body;
  const verse = verses.find(v => v.ref === ref);
  if (!verse) return res.status(404).json({ error: 'Verset introuvable dans la bibliothèque.' });

  await db.read();
  const already = db.data.bibleMemorization.find(m => m.userId === req.user.id && m.ref === ref);
  if (already) return res.status(409).json({ error: 'Ce verset est déjà dans ta liste de mémorisation.' });

  const item = {
    id: nanoid(), userId: req.user.id, ref: verse.ref, text: verse.text,
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
