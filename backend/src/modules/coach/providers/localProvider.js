// Provider 100% gratuit et local : pas d'appel réseau, pas de coût.
// Il ne "comprend" pas le langage comme un vrai LLM : il applique des règles
// simples de coaching réflexif (proche de l'écoute active) pour rester utile
// en attendant qu'un vrai modèle (local ou payant) soit branché en Phase 5.

const REFLECTIVE_STARTERS = [
  "Qu'est-ce qui, selon toi, a déclenché cette situation ?",
  "Si tu devais nommer l'émotion principale que tu ressens là, ce serait laquelle ?",
  "Qu'est-ce que tu aimerais qu'il se passe ensuite ?",
  "Qu'est-ce que tu sais avec certitude, et qu'est-ce que tu supposes seulement ?",
  "Sur une échelle de 1 à 10, à quel point c'est important pour toi aujourd'hui ?"
];

const KEYWORD_RULES = [
  { match: /frustr|colère|énervé/i, note: "Tu sembles ressentir de la frustration ou de la colère." },
  { match: /triste|déprim|down/i, note: "Ça a l'air d'être une période difficile émotionnellement." },
  { match: /copine|partenaire|relation/i, note: "Il s'agit d'un sujet relationnel." },
  { match: /travail|boulot|carrière/i, note: "Ça touche ta vie professionnelle." },
  { match: /argent|finance|budget/i, note: "C'est un sujet lié aux finances." },
  { match: /bible|dieu|prière|spirituel/i, note: "C'est une réflexion d'ordre spirituel." }
];

export async function localProviderReply(messages, context = {}) {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const matched = KEYWORD_RULES.find(r => r.match.test(lastUserMessage));
  const starter = REFLECTIVE_STARTERS[Math.floor(Math.random() * REFLECTIVE_STARTERS.length)];

  const parts = [];
  if (matched) parts.push(matched.note);
  parts.push(
    "Je suis un coach réflexif en mode local (gratuit) : je t'aide surtout à structurer ta pensée, " +
    "je ne décide rien à ta place."
  );
  parts.push(starter);

  return parts.join(' ');
}
