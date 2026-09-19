// Brave Search API : https://brave.com/search/api/
// Palier gratuit disponible (2 000 requêtes/mois au moment de l'écriture,
// à vérifier sur leur site car les conditions changent). Nécessite de créer
// un compte et de générer une clé API, à mettre dans SEARCH_API_KEY (.env).
export async function braveSearch(query, apiKey) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave Search a répondu avec le statut ${response.status}`);
  }

  const data = await response.json();
  const results = (data.web?.results || []).slice(0, 5).map(r => ({
    title: r.title, url: r.url, snippet: r.description || ''
  }));

  return {
    query,
    hasInternetAccess: true,
    results,
    note: results.length
      ? "Résultats fournis par Brave Search. Vérifie toujours les sources par toi-même pour les informations importantes."
      : "Aucun résultat trouvé pour cette recherche."
  };
}
