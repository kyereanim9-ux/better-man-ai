import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { chatWithFallback } from '../../ai/textChatRouter.js';

const router = Router();
router.use(requireAuth);
// En test : réservé à l'administrateur. Retirer requireAdmin pour l'ouvrir à tous.
router.use(requireAdmin);

// --- Expression orale : conversations d'entraînement en plusieurs langues ---
// L'historique vit côté navigateur (rien n'est stocké ici) : chaque tour envoie
// la conversation en cours, le serveur renvoie la réplique du partenaire IA.
// Sans clé d'IA configurée, un partenaire local simple prend le relais.

export const SPEAKING_LANGS = {
  fr: 'français', en: 'English', es: 'español', ko: '한국어 (coréen)', de: 'Deutsch',
  it: 'italiano', pt: 'português', ja: '日本語 (japonais)', zh: '中文 (chinois mandarin)', ar: 'العربية (arabe)'
};

const LEVELS = {
  debutant: 'Le pratiquant est débutant dans cette langue : phrases très courtes, vocabulaire simple, parle lentement.',
  intermediaire: 'Le pratiquant a un niveau intermédiaire : phrases naturelles mais claires.',
  avance: 'Le pratiquant est avancé : parle naturellement, avec expressions idiomatiques.'
};

export const SCENARIOS = {
  smalltalk: {
    name: 'Discussion libre',
    role: "Tu es un(e) ami(e) sympathique qui discute de tout et de rien : journée, passions, projets. Relance avec des questions ouvertes."
  },
  meet: {
    name: 'Rencontrer quelqu\'un',
    role: "Tu es une personne que le pratiquant rencontre pour la première fois lors d'une soirée entre amis. Sois chaleureux(se) mais un peu réservé(e) au début ; ouvre-toi s'il pose de bonnes questions et écoute vraiment."
  },
  flirt: {
    name: 'Séduction (flirt)',
    role: "Tu es une femme adulte, célibataire, pleine d'esprit, que le pratiquant aborde dans un café. Joue le jeu du flirt léger : taquineries, humour, complicité. Réagis de façon réaliste : chaleureuse face à l'humour, la curiosité sincère et l'assurance tranquille ; plus froide face aux phrases toutes faites, à l'insistance, aux compliments uniquement physiques ou à la vulgarité. Reste toujours respectueuse et dans le registre du flirt bienveillant, jamais sexuel explicite."
  },
  date: {
    name: 'Premier rendez-vous',
    role: "Tu es la personne avec qui le pratiquant a un premier rendez-vous au restaurant. Tu es curieuse de le connaître ; partage aussi des choses sur toi. Récompense l'écoute active et les questions personnelles, réagis moins bien s'il ne parle que de lui."
  },
  interview: {
    name: 'Entretien d\'embauche',
    role: "Tu es recruteur(se) pour un poste qui intéresse le pratiquant. Pose des questions classiques d'entretien (parcours, forces, un échec, pourquoi ce poste) une par une, et demande des exemples concrets."
  },
  cafe: {
    name: 'Commander au café / restaurant',
    role: "Tu es serveur(se) dans un café. Accueille, propose la carte, réponds aux questions, gère une petite complication (un plat indisponible)."
  },
  conflict: {
    name: 'Désamorcer un désaccord',
    role: "Tu es un(e) collègue ou proche légèrement agacé(e) parce que le pratiquant a oublié un engagement important. Exprime ta frustration de manière réaliste ; calme-toi s'il écoute, reconnaît et propose une solution, durcis-toi s'il se justifie ou minimise."
  },
  pitch: {
    name: 'Présenter une idée',
    role: "Tu es un(e) responsable occupé(e) à qui le pratiquant présente une idée ou un projet. Sois exigeant(e) : demande d'aller à l'essentiel, pose des questions sur les bénéfices, les coûts et les risques."
  }
};

function systemPrompt({ scenario, lang, level }) {
  const sc = SCENARIOS[scenario] || SCENARIOS.smalltalk;
  const langName = SPEAKING_LANGS[lang] || SPEAKING_LANGS.fr;
  return [
    `Jeu de rôle d'entraînement à la conversation orale. ${sc.role}`,
    `Langue : réponds UNIQUEMENT en ${langName}, même si le pratiquant écrit dans une autre langue.`,
    LEVELS[level] || LEVELS.intermediaire,
    "Ce que dit le pratiquant vient d'une transcription vocale automatique : ignore les petites fautes de transcription.",
    "Reste dans ton rôle. Réponds comme à l'oral : 1 à 3 phrases courtes, naturelles, sans listes, sans emoji, sans didascalies. Termine souvent par une question ou une ouverture pour qu'il continue à parler.",
    "Ne corrige pas le pratiquant pendant la conversation : le bilan viendra à la fin."
  ].join('\n');
}

// Partenaire local (sans clé d'IA) : relances simples par langue, pour que
// l'exercice reste utilisable gratuitement.
const LOCAL_LINES = {
  fr: ['Ah oui ? Raconte-moi plus.', "Intéressant ! Et pourquoi ça ?", "Qu'est-ce qui t'a donné envie de ça ?", "Et toi, comment tu l'as vécu ?", "Je ne savais pas ! Tu peux me donner un exemple ?", "D'accord. Et ensuite, qu'est-ce qui s'est passé ?"],
  en: ['Oh really? Tell me more.', 'Interesting! Why is that?', 'What got you into that?', 'How did that feel for you?', 'I had no idea! Can you give me an example?', 'Okay. And what happened next?'],
  es: ['¿Ah, sí? Cuéntame más.', '¡Interesante! ¿Y por qué?', '¿Qué te hizo interesarte en eso?', '¿Y cómo lo viviste tú?', '¡No lo sabía! ¿Me das un ejemplo?', 'Vale. ¿Y qué pasó después?'],
  ko: ['아, 정말요? 더 얘기해 주세요.', '흥미롭네요! 왜요?', '어떻게 관심을 갖게 됐어요?', '그때 기분이 어땠어요?', '몰랐어요! 예를 들어 줄 수 있어요?', '그렇군요. 그다음엔 어떻게 됐어요?'],
  de: ['Ach wirklich? Erzähl mir mehr.', 'Interessant! Warum?', 'Wie bist du dazu gekommen?', 'Wie hast du das erlebt?', 'Das wusste ich nicht! Hast du ein Beispiel?', 'Okay. Und was ist dann passiert?'],
  it: ['Ah sì? Raccontami di più.', 'Interessante! Perché?', 'Come ti sei appassionato a questo?', 'E tu come l\'hai vissuta?', 'Non lo sapevo! Mi fai un esempio?', 'Va bene. E poi cos\'è successo?'],
  pt: ['Ah, é? Conta mais.', 'Interessante! Por quê?', 'O que te fez gostar disso?', 'E como foi isso para você?', 'Eu não sabia! Pode dar um exemplo?', 'Certo. E depois, o que aconteceu?'],
  ja: ['へえ、本当？もっと聞かせて。', '面白いね！どうして？', 'どうしてそれに興味を持ったの？', 'そのとき、どう感じた？', '知らなかった！例を教えてくれる？', 'なるほど。それからどうなったの？'],
  zh: ['真的吗？多说一点吧。', '有意思！为什么呢？', '你是怎么对这个感兴趣的？', '那时候你感觉怎么样？', '我不知道！能举个例子吗？', '好的。然后发生了什么？'],
  ar: ['حقاً؟ أخبرني أكثر.', 'مثير للاهتمام! لماذا؟', 'ما الذي جعلك تهتم بذلك؟', 'وكيف شعرت حينها؟', 'لم أكن أعرف! هل يمكنك إعطائي مثالاً؟', 'حسناً. وماذا حدث بعد ذلك؟']
};

const LOCAL_OPENERS = {
  fr: 'Salut ! Comment se passe ta journée ?', en: 'Hi! How is your day going?', es: '¡Hola! ¿Qué tal tu día?',
  ko: '안녕하세요! 오늘 하루 어땠어요?', de: 'Hallo! Wie läuft dein Tag?', it: 'Ciao! Come va la giornata?',
  pt: 'Oi! Como está o seu dia?', ja: 'こんにちは！今日はどんな一日？', zh: '你好！你今天过得怎么样？', ar: 'مرحباً! كيف يومك؟'
};

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-30)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
}

router.get('/options', (req, res) => {
  res.json({
    langs: SPEAKING_LANGS,
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.name]))
  });
});

// Un tour de conversation. history vide = le partenaire ouvre la conversation.
router.post('/turn', async (req, res) => {
  const { scenario = 'smalltalk', lang = 'fr', level = 'intermediaire' } = req.body || {};
  if (!SCENARIOS[scenario]) return res.status(400).json({ error: 'Scénario inconnu.' });
  if (!SPEAKING_LANGS[lang]) return res.status(400).json({ error: 'Langue non prise en charge.' });
  const history = cleanHistory(req.body?.history);
  const messages = [{ role: 'system', content: systemPrompt({ scenario, lang, level }) }];
  if (!history.length) {
    messages.push({ role: 'user', content: "(Le pratiquant arrive. Ouvre la conversation toi-même avec une première réplique courte, dans ton rôle.)" });
  } else {
    messages.push(...history);
  }
  try {
    const { content, providerUsed } = await chatWithFallback(messages);
    res.json({ reply: content.trim(), source: providerUsed });
  } catch {
    const lines = LOCAL_LINES[lang] || LOCAL_LINES.fr;
    const turns = history.filter(m => m.role === 'user').length;
    res.json({
      reply: turns === 0 ? (LOCAL_OPENERS[lang] || LOCAL_OPENERS.fr) : lines[(turns - 1) % lines.length],
      source: 'local',
      note: "Partenaire simplifié : aucune IA n'est configurée sur le serveur, les réponses sont des relances génériques."
    });
  }
});

// Bilan de fin de conversation : clarté, aisance, écoute, conseils concrets.
router.post('/feedback', async (req, res) => {
  const { scenario = 'smalltalk', lang = 'fr', fillers = 0, wordsPerMinute = null } = req.body || {};
  const history = cleanHistory(req.body?.history);
  const userTurns = history.filter(m => m.role === 'user');
  if (userTurns.length < 2) return res.status(400).json({ error: 'Parle au moins deux fois avant de demander un bilan.' });
  const sc = SCENARIOS[scenario] || SCENARIOS.smalltalk;
  const transcript = history.map(m => `${m.role === 'user' ? 'PRATIQUANT' : 'PARTENAIRE'} : ${m.content}`).join('\n');
  const prompt = [
    `Tu es un coach en communication orale. Voici une conversation d'entraînement (scénario : ${sc.name}, langue pratiquée : ${SPEAKING_LANGS[lang] || lang}).`,
    `Mots de remplissage détectés : ${Number(fillers) || 0}.${wordsPerMinute ? ` Débit moyen : ${wordsPerMinute} mots/minute.` : ''}`,
    "Donne un bilan EN FRANÇAIS, bref et concret, avec exactement ces rubriques :",
    "Note globale : x/10",
    "Points forts : 2 points précis, en citant ses mots.",
    "À améliorer : 2 ou 3 points précis (clarté, questions posées, écoute, assurance, longueur des réponses, et pour la séduction : humour, respect, curiosité sincère).",
    "Corrections de langue : jusqu'à 3 phrases du pratiquant reformulées de façon plus naturelle dans la langue pratiquée (si la langue n'est pas le français).",
    "Phrase à essayer la prochaine fois : une seule, dans la langue pratiquée.",
    "La transcription vient d'une reconnaissance vocale : ne reproche pas les erreurs qui ressemblent à des fautes de transcription.",
    '',
    transcript
  ].join('\n');
  try {
    const { content, providerUsed } = await chatWithFallback([{ role: 'user', content: prompt }]);
    res.json({ feedback: content.trim(), source: providerUsed });
  } catch {
    const questions = userTurns.filter(m => /[?？؟]/.test(m.content)).length;
    const avgWords = Math.round(userTurns.reduce((n, m) => n + m.content.split(/\s+/).length, 0) / userTurns.length);
    const tips = [];
    tips.push(questions ? `Tu as posé ${questions} question(s) : c'est ce qui montre de l'intérêt. Continue.` : "Tu n'as posé aucune question : pose-en au moins une toutes les deux répliques pour montrer ton intérêt.");
    tips.push(avgWords < 6 ? `Tes réponses sont très courtes (${avgWords} mots en moyenne) : développe avec un détail ou une petite histoire.` : avgWords > 60 ? `Tes réponses sont longues (${avgWords} mots en moyenne) : laisse plus de place à l'autre.` : `Longueur de réponse équilibrée (${avgWords} mots en moyenne).`);
    if (Number(fillers) > 3) tips.push(`${fillers} mots de remplissage : remplace-les par une courte pause silencieuse.`);
    res.json({ feedback: 'Bilan simplifié (aucune IA configurée) :\n' + tips.map(t => '• ' + t).join('\n'), source: 'local' });
  }
});

export default router;
