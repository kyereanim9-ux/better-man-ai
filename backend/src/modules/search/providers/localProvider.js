// Provider par défaut : honnête sur le fait qu'aucun accès Internet n'est
// configuré, plutôt que d'inventer des résultats (jamais de fausse source).
export async function localSearch(query, extraNote = '') {
  return {
    query,
    hasInternetAccess: false,
    results: [],
    note: [
      "Aucun fournisseur de recherche web n'est configuré (mode local, 0 €).",
      extraNote,
      "Pour activer la recherche, configure SEARCH_PROVIDER=brave et SEARCH_API_KEY dans .env (voir .env.example)."
    ].filter(Boolean).join(' ')
  };
}
