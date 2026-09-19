import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { detectDomains } from '../../shared/domainKeywords.js';

const router = Router();
router.use(requireAuth);

const GENERIC_QUESTIONS = [
  "Qu'est-ce que tu as ressenti sur le moment, précisément ?",
  "Qu'est-ce qui, selon toi, a déclenché cette réaction ?",
  "Qu'aurais-tu pu faire différemment, avec le recul ?",
  "Quelle réponse aurait été plus mature dans ce contexte ?",
  "Qu'est-ce que tu sais avec certitude, et qu'est-ce que tu supposes seulement ?"
];

const DOMAIN_QUESTIONS = {
  relationnel: "Qu'est-ce que l'autre personne a peut-être ressenti de son côté (sans le savoir avec certitude) ?",
  communication: "Comment aurais-tu pu formuler la même idée de façon plus claire ou plus calme ?",
  financier: "Cette dépense/décision correspond-elle à l'un de tes objectifs financiers actuels ?",
  professionnel: "Qu'est-ce que cette situation révèle sur une compétence à développer ?",
  discipline: "Quel est le déclencheur concret qui t'a fait dévier de ton intention initiale ?",
  intime: "As-tu communiqué clairement ce besoin, ou l'as-tu seulement supposé ?"
};

function buildReflection(text, domains) {
  const questions = [...GENERIC_QUESTIONS.slice(0, 3)];
  for (const d of domains) {
    if (DOMAIN_QUESTIONS[d]) questions.push(DOMAIN_QUESTIONS[d]);
  }
  const suggestion =
    "Avant de répondre ou d'agir : relis tes réponses aux questions ci-dessus, " +
    "identifie UNE seule action concrète et raisonnable à faire maintenant " +
    "(pas cinq), puis fais-la. Tu pourras revenir ici évaluer si ça a aidé.";

  return { questions: questions.slice(0, 5), suggestion };
}

// Analyse une situation réelle décrite par l'utilisateur.
router.post('/', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Décris la situation avant de l\'envoyer.' });

  const domains = detectDomains(content, ['emotionnel']);
  const { questions, suggestion } = buildReflection(content, domains);

  await db.read();
  const situation = {
    id: nanoid(), userId: req.user.id, content, domains, questions, suggestion,
    createdAt: new Date().toISOString()
  };
  db.data.situations.push(situation);
  await db.write();
  res.status(201).json(situation);
});

router.get('/', async (req, res) => {
  await db.read();
  const list = db.data.situations
    .filter(s => s.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.situations.length;
  db.data.situations = db.data.situations.filter(
    s => !(s.id === req.params.id && s.userId === req.user.id)
  );
  if (db.data.situations.length === before) return res.status(404).json({ error: 'Situation introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// Détection de schémas répétitifs sur les situations des 30 derniers jours.
// Reste volontairement simple et transparent : comptage par domaine, pas une
// analyse psychologique. Le seuil (>=3 occurrences, sur au moins 2 jours
// différents) évite de signaler un schéma sur une seule mauvaise journée.
router.get('/patterns', async (req, res) => {
  await db.read();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const recent = db.data.situations.filter(
    s => s.userId === req.user.id && new Date(s.createdAt) >= cutoff
  );

  const byDomain = {};
  for (const s of recent) {
    for (const d of s.domains) {
      byDomain[d] ??= { count: 0, days: new Set() };
      byDomain[d].count++;
      byDomain[d].days.add(s.createdAt.slice(0, 10));
    }
  }

  const recurringPatterns = Object.entries(byDomain)
    .filter(([, v]) => v.count >= 3 && v.days.size >= 2)
    .map(([domain, v]) => ({
      domain, count: v.count, distinctDays: v.days.size,
      note: `Tu as décrit ${v.count} situations liées à "${domain}" sur ${v.days.size} jours différents ces 30 derniers jours.`
    }))
    .sort((a, b) => b.count - a.count);

  res.json({
    totalSituations: recent.length,
    byDomain: Object.entries(byDomain).map(([domain, v]) => ({ domain, count: v.count })),
    recurringPatterns,
    note: recurringPatterns.length
      ? "Ceci est un comptage simple, pas un diagnostic. Utilise-le comme point de départ pour réfléchir, pas comme une vérité absolue."
      : "Pas encore de schéma répétitif net détecté (il faut au moins 3 situations sur le même thème, sur 2 jours distincts, en 30 jours)."
  });
});

export default router;
