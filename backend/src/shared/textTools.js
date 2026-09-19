// Outils de traitement de texte 100% locaux (aucun appel réseau, aucune IA
// payante). Utilisent des techniques classiques de résumé extractif :
// fréquence des mots -> score des phrases -> sélection des meilleures.
// Ce n'est pas une compréhension réelle du texte, juste un repérage
// statistique des phrases/mots les plus représentatifs.

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'à', 'au', 'aux',
  'ce', 'ces', 'cet', 'cette', 'que', 'qui', 'quoi', 'dont', 'où', 'il', 'elle',
  'ils', 'elles', 'on', 'nous', 'vous', 'je', 'tu', 'se', 'sa', 'son', 'ses',
  'leur', 'leurs', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'notre', 'votre',
  'pour', 'par', 'avec', 'sans', 'dans', 'sur', 'sous', 'entre', 'est', 'sont',
  'était', 'être', 'avoir', 'a', 'ont', 'pas', 'ne', 'plus', 'moins', 'très',
  'donc', 'or', 'ni', 'car', 'mais', 'si', 'comme', 'alors', 'aussi', 'tout',
  'tous', 'toute', 'toutes', 'cela', 'ceci', 'lui', 'y', 'en', 'the', 'a', 'of',
  'and', 'to', 'in', 'is', 'it', 'that', 'this'
]);

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // ignore les fragments trop courts (titres, listes...)
}

function wordFrequencies(text) {
  const words = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüÿçœæ]+/gi) || [];
  const freq = {};
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

// Résumé extractif : sélectionne les `count` phrases les mieux notées
// (fréquence des mots qu'elles contiennent), dans leur ordre d'origine.
export function extractiveSummary(text, count = 5) {
  const sentences = splitSentences(text);
  if (sentences.length <= count) return sentences;

  const freq = wordFrequencies(text);
  const scored = sentences.map((s, index) => {
    const words = s.toLowerCase().match(/[a-zàâäéèêëïîôöùûüÿçœæ]+/gi) || [];
    const score = words.reduce((sum, w) => sum + (freq[w] || 0), 0) / Math.max(1, words.length);
    return { s, index, score };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, count);
  return top.sort((a, b) => a.index - b.index).map(t => t.s);
}

// Extrait les mots-clés les plus fréquents (idées principales approximatives).
export function keyTerms(text, count = 10) {
  const freq = wordFrequencies(text);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

// Génère des cartes mémoire à trous à partir des phrases les plus importantes.
export function generateFlashcards(text, count = 5) {
  const topSentences = extractiveSummary(text, count);
  return topSentences.map(sentence => {
    const words = sentence.split(' ');
    const candidates = words.map((w, i) => i).filter(i => words[i].replace(/[.,;:!?]/g, '').length > 4);
    if (!candidates.length) return null;
    const blankIndex = candidates[Math.floor(Math.random() * candidates.length)];
    const answer = words[blankIndex].replace(/[.,;:!?]/g, '');
    const prompt = words.map((w, i) => (i === blankIndex ? '_____' : w)).join(' ');
    return { prompt, answer };
  }).filter(Boolean);
}

// Génère quelques questions de compréhension générales (pas spécifiques au
// contenu réel, faute de compréhension sémantique — volontairement honnête).
export function generateComprehensionQuestions(topSentences) {
  return [
    "Résume ce passage avec tes propres mots, en une ou deux phrases.",
    "Quelle est l'idée la plus utile ou surprenante que tu retiens ?",
    "Comment pourrais-tu appliquer concrètement ce que tu viens de lire ?",
    ...topSentences.slice(0, 2).map(s => `Que veut dire, selon toi : "${s.length > 90 ? s.slice(0, 90) + '…' : s}" ?`)
  ];
}
