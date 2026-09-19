import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Générateur de brouillons de réponse. Mode local (gratuit) : ce sont des
// SQUELETTES à personnaliser avec un détail réel du message reçu, pas des
// réponses toutes faites à copier-coller. Priorité à l'authenticité et au
// respect — jamais de technique de manipulation ou de pression.
function replyVariants() {
  return {
    naturel: "Ah, [réagis à ce qu'elle vient de dire] — moi de mon côté [partage un détail bref de ta journée]. Et toi, comment se passe la suite de ta journée ?",
    romantique: "Tu sais que ton message m'a fait sourire ? [ajoute un détail précis et sincère sur ce que tu apprécies chez elle ou dans l'échange].",
    drole: "Alors là... [taquine gentiment sur un détail précis de son message, jamais méchant] — j'avoue que tu m'as eu 😄",
    flirt: "Continue comme ça et je vais finir par penser à toi le reste de la journée... [garde un ton léger, jamais insistant].",
    profond: "Ce que tu viens de partager me touche. [pose une vraie question sur ce qu'elle ressent] — je veux comprendre ce que tu vis, pas juste répondre vite.",
    direct: "J'aime bien parler avec toi. [dis clairement ce que tu veux : continuer à discuter, la revoir...] Dis-moi si ça te va aussi."
  };
}

router.post('/suggest-reply', (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Colle le message reçu avant de demander des suggestions.' });
  res.json({
    original: message,
    suggestions: replyVariants(),
    note: "Ce sont des brouillons de départ, pas des réponses à copier-coller : remplace les crochets par un vrai détail de son message. " +
      "Reste toi-même, reste respectueux, et n'insiste jamais si l'enthousiasme n'est pas réciproque."
  });
});

// Analyse basique d'une conversation collée par l'utilisateur.
// Ne prend jamais parti automatiquement et ne prétend pas lire les intentions
// de l'autre personne (cahier des charges §2.B).
router.post('/analyze-conversation', (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Colle la conversation avant de l\'analyser.' });

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const questionCount = (text.match(/\?/g) || []).length;
  const tensionRegex = /\bjamais\b|\btoujours\b|tu dois|tu devrais|de toute façon|peu importe|n'importe quoi/i;
  const possibleTensionLines = lines.filter(l => tensionRegex.test(l));

  const tips = [];
  if (questionCount === 0) {
    tips.push("Aucune question posée dans cet échange : en poser une peut montrer un intérêt réel et relancer la conversation.");
  }
  if (possibleTensionLines.length) {
    tips.push("Certaines formulations (\"toujours\", \"jamais\", \"tu dois\"...) peuvent être perçues comme des généralisations ou des reproches, même sans intention négative.");
  }
  if (lines.length >= 3 && lines.every(l => l.length < 15)) {
    tips.push("Les messages sont très courts : selon le contexte, ça peut passer pour du désintérêt — à toi de juger si c'est le cas ici.");
  }
  if (!tips.length) {
    tips.push("Rien de particulier à signaler avec cette analyse simple. Fais confiance à ton propre ressenti sur le ton de l'échange.");
  }

  res.json({
    lineCount: lines.length,
    questionCount,
    possibleTensionLines,
    tips,
    reflectionPrompts: [
      "Qu'est-ce que TU sais avec certitude sur ce que l'autre personne ressent ?",
      "Qu'est-ce que tu supposes seulement, sans en avoir la confirmation ?",
      "Quelle question pourrais-tu poser directement plutôt que de deviner ?"
    ],
    disclaimer: "Analyse automatique basée sur des mots-clés, pas une lecture réelle des intentions de l'autre personne. " +
      "Elle ne prend jamais ton parti automatiquement : ton propre comportement peut aussi avoir contribué à la situation."
  });
});

export default router;
