import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { detectDomains } from '../../shared/domainKeywords.js';

const router = Router();
router.use(requireAuth);

// Questions de réflexion générées selon les domaines détectés dans le texte —
// même logique que le module Situation, appliquée ici au journal libre.
const GENERIC_QUESTIONS = [
  "Qu'est-ce que tu as ressenti en écrivant ça ?",
  "Qu'est-ce qui, selon toi, a déclenché cette situation ou ce ressenti ?",
  "Qu'aurais-tu pu faire différemment ?"
];
const DOMAIN_QUESTIONS = {
  emotionnel: "Quelle émotion nommerais-tu en premier, si tu devais n'en choisir qu'une ?",
  relationnel: "Qu'est-ce que l'autre personne a peut-être ressenti de son côté ?",
  communication: "Comment aurais-tu pu formuler la même idée plus clairement ?",
  financier: "Cette situation touche-t-elle un de tes objectifs financiers ?",
  professionnel: "Qu'est-ce que cette situation révèle sur une compétence à développer ?",
  discipline: "Quel est le déclencheur concret qui t'a fait dévier ?",
  intime: "As-tu communiqué clairement ce besoin, ou l'as-tu seulement supposé ?",
  physique: "Comment ton corps a-t-il influencé ton état aujourd'hui ?",
  spirituel: "Qu'est-ce que cela t'apprend sur toi-même ?"
};
function buildReflection(domains) {
  const questions = [...GENERIC_QUESTIONS];
  for (const d of domains) if (DOMAIN_QUESTIONS[d]) questions.push(DOMAIN_QUESTIONS[d]);
  return questions.slice(0, 5);
}

router.get('/', async (req, res) => {
  await db.read();
  const entries = db.data.journalEntries
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(entries);
});

router.post('/', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Le contenu du journal est vide.' });

  const domains = detectDomains(content, []);
  const questions = buildReflection(domains);

  await db.read();
  const entry = {
    id: nanoid(), userId: req.user.id, content, domains, questions,
    note: "Analyse simple par mots-clés, pas un diagnostic — sers-toi des questions pour réfléchir, pas comme une conclusion toute faite.",
    createdAt: new Date().toISOString()
  };
  db.data.journalEntries.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.journalEntries.length;
  db.data.journalEntries = db.data.journalEntries.filter(
    e => !(e.id === req.params.id && e.userId === req.user.id)
  );
  if (db.data.journalEntries.length === before) return res.status(404).json({ error: 'Entrée introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
