// Retire les accents (é -> e, à -> a, etc.) pour des comparaisons de texte
// robustes, que la personne tape avec ou sans accents (usage mobile rapide,
// clavier non français...). Utilisé partout où l'app compare un texte libre
// à une liste de mots-clés.
export function stripAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
