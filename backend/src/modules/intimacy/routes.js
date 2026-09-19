import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// --- CONTRÔLE D'ACCÈS ---
// Section séparée du reste de l'app : accès bloqué tant que l'utilisateur n'a
// pas explicitement confirmé avoir 18 ans ou plus ET vouloir activer cette
// section. C'est une auto-déclaration (pas une vérification d'identité réelle
// — aucune app gratuite ne peut garantir ça), mais elle empêche un accès
// accidentel et pose un geste d'activation volontaire clair.
async function requireIntimacyAccess(req, res, next) {
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user?.intimacyAccessConfirmed) {
    return res.status(403).json({ error: 'Confirme d\'abord ton accès à cette section (18 ans ou plus).', accessRequired: true });
  }
  next();
}

router.get('/access', async (req, res) => {
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  res.json({ confirmed: !!user?.intimacyAccessConfirmed, confirmedAt: user?.intimacyAccessConfirmedAt || null });
});

router.post('/confirm-access', async (req, res) => {
  const { ageConfirmed, consentConfirmed } = req.body;
  if (ageConfirmed !== true || consentConfirmed !== true) {
    return res.status(400).json({ error: 'Les deux confirmations (âge et consentement à activer cette section) sont requises.' });
  }
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  user.intimacyAccessConfirmed = true;
  user.intimacyAccessConfirmedAt = new Date().toISOString();
  await db.write();
  res.json({ confirmed: true });
});

router.post('/revoke-access', async (req, res) => {
  await db.read();
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  user.intimacyAccessConfirmed = false;
  await db.write();
  res.json({ confirmed: false });
});

router.use(requireIntimacyAccess);

// --- CONTENU ÉDUCATIF ---
// Contenu de communication/relation, jamais de description explicite d'actes.
// Toujours centré sur le consentement, le respect, la communication.
const TOPICS = [
  {
    id: 'communication',
    title: 'Parler de sexualité avec ta/ton partenaire',
    body: "Ce n'est pas une négociation ponctuelle, c'est une conversation continue. Choisis un moment calme, hors de la chambre, sans pression de temps. Commence par ce que tu apprécies plutôt que par ce qui ne va pas. Pose des questions ouvertes (\"Qu'est-ce qui te ferait plaisir en ce moment ?\") plutôt que de deviner.",
    reflectionQuestions: [
      "Quand avez-vous parlé de ce sujet pour la dernière fois, en dehors de l'intimité elle-même ?",
      "Qu'est-ce que tu n'as jamais osé demander à ta/ton partenaire, et pourquoi ?"
    ]
  },
  {
    id: 'consentement',
    title: 'Le consentement',
    body: "Le consentement est clair, donné librement, spécifique, et peut être retiré à tout moment — par l'un ou l'autre, à n'importe quel stade, sans avoir à se justifier. L'absence de \"non\" n'est pas un \"oui\". Le silence ou l'hésitation méritent qu'on s'arrête et qu'on vérifie. Un climat de confiance se construit en normalisant le fait de demander et de répondre honnêtement, y compris \"pas envie ce soir\".",
    reflectionQuestions: [
      "Te sens-tu aussi à l'aise de dire non que de dire oui dans ta relation actuelle ?",
      "Comment vérifies-tu, dans l'instant, que l'autre est aussi partant(e) que toi ?"
    ]
  },
  {
    id: 'desir-vs-pression',
    title: 'Désir réel ou pression ?',
    body: "Le désir authentique vient de l'envie, pas de l'obligation, de la peur de décevoir, ou de l'habitude. Se sentir \"redevable\" après un cadeau, une sortie, ou pour \"maintenir la relation\" est un signal à prendre au sérieux — dans un sens comme dans l'autre. Une relation saine laisse de la place à un \"non\" sans conséquence négative.",
    reflectionQuestions: [
      "As-tu déjà dit oui par obligation plutôt que par envie ? Qu'est-ce qui aurait aidé à dire non ?",
      "Comment réagis-tu quand ta/ton partenaire décline ? Est-ce accueilli sans reproche ?"
    ]
  },
  {
    id: 'anxiete-performance',
    title: "Anxiété de performance",
    body: "Se concentrer sur \"assurer\" plutôt que sur la connexion et le plaisir partagé alimente souvent le problème qu'on cherche à éviter. En parler ouvertement avec ta/ton partenaire réduit généralement la pression bien plus que d'y faire face seul en silence. Si l'anxiété est persistante ou envahissante, ou s'il y a une inquiétude médicale sous-jacente, un médecin ou un sexologue peut aider.",
    reflectionQuestions: [
      "Dans quelles situations précises cette pression apparaît-elle le plus ?",
      "Qu'est-ce que ça changerait d'en parler ouvertement avec ta/ton partenaire, plutôt que de le cacher ?"
    ]
  },
  {
    id: 'sante-generale',
    title: 'Santé sexuelle générale',
    body: "Quelques repères généraux : dépistages réguliers si tu as plusieurs partenaires ou un nouveau partenaire, discussion ouverte sur la contraception et la protection avant l'intimité (pas après), et consultation d'un professionnel de santé pour toute question médicale précise. Cette app ne remplace jamais un avis médical — elle t'aide à réfléchir et communiquer, pas à te diagnostiquer.",
    reflectionQuestions: [
      "Ta/ton partenaire et toi avez-vous eu cette conversation clairement, une fois pour toutes ?",
      "Y a-t-il une question de santé que tu repousses depuis un moment ?"
    ]
  },
  {
    id: 'preferences',
    title: 'Discuter des préférences',
    body: "Personne ne devine parfaitement ce que l'autre aime. Demander directement (\"Qu'est-ce que tu aimes particulièrement ?\", \"Qu'est-ce que tu aimerais essayer ?\") vaut mieux que de supposer. Accueille la réponse sans jugement, même si elle te surprend — et sens-toi tout aussi libre de partager les tiennes.",
    reflectionQuestions: [
      "As-tu déjà demandé directement à ta/ton partenaire ce qu'elle/il aime le plus ?",
      "Qu'est-ce que tu aimerais partager toi-même, mais n'as jamais osé dire ?"
    ]
  }
];

router.get('/topics', (req, res) => {
  res.json(TOPICS);
});

// --- SUGGESTIONS DE MESSAGES (romantiques / suggestifs, entre adultes consentants) ---
// Toujours des SQUELETTES à personnaliser, jamais du contenu explicite tout
// fait — même logique que le module communication, avec un ton plus intime.
router.post('/message-suggestions', (req, res) => {
  const { tone } = req.body;
  const variants = {
    romantique: "J'ai pensé à toi toute la journée... [ajoute un souvenir précis et sincère d'un moment à deux]. J'ai hâte de te retrouver.",
    suggestif: "Tu me manques déjà, et j'ai hâte de [reste évocateur mais reste toi-même, évite le graphique si ce n'est pas votre style habituel]. Dis-moi si tu ressens la même chose."
  };
  if (!['romantique', 'suggestif'].includes(tone)) {
    return res.status(400).json({ error: 'tone doit être "romantique" ou "suggestif".' });
  }
  res.json({
    suggestion: variants[tone],
    note: "Un squelette à personnaliser avec ton propre ton et vos codes à vous deux, jamais à copier tel quel. " +
      "N'envoie ce genre de message qu'à un(e) partenaire adulte et consentant(e), et reste attentif(ve) à sa réponse."
  });
});

// --- JOURNAL PRIVÉ DÉDIÉ (séparé du journal général, cahier des charges §15) ---
router.get('/journal', async (req, res) => {
  await db.read();
  const entries = db.data.intimacyEntries
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(entries);
});

router.post('/journal', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu vide.' });
  await db.read();
  const entry = { id: nanoid(), userId: req.user.id, content, createdAt: new Date().toISOString() };
  db.data.intimacyEntries.push(entry);
  await db.write();
  res.status(201).json(entry);
});

router.delete('/journal/:id', async (req, res) => {
  await db.read();
  const before = db.data.intimacyEntries.length;
  db.data.intimacyEntries = db.data.intimacyEntries.filter(
    e => !(e.id === req.params.id && e.userId === req.user.id)
  );
  if (db.data.intimacyEntries.length === before) return res.status(404).json({ error: 'Entrée introuvable.' });
  await db.write();
  res.json({ ok: true });
});

export default router;
