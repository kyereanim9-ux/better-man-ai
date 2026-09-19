// Interface commune, même principe que coach/aiProvider.js.
//
// IMPORTANT — réalité honnête : il n'existe pas d'API de recherche web
// réellement gratuite et illimitée. Sans clé configurée, l'app répond
// clairement qu'elle n'a pas accès à Internet plutôt que d'inventer des
// résultats. Pour activer la recherche, configure SEARCH_PROVIDER et
// SEARCH_API_KEY dans .env (voir .env.example) — Brave Search propose un
// palier gratuit (2 000 requêtes/mois) largement suffisant pour un usage personnel.
import { localSearch } from './providers/localProvider.js';
import { braveSearch } from './providers/braveProvider.js';

export async function performSearch(query) {
  const provider = process.env.SEARCH_PROVIDER || 'local';

  switch (provider) {
    case 'brave':
      if (!process.env.SEARCH_API_KEY) {
        return localSearch(query, "SEARCH_PROVIDER=brave mais SEARCH_API_KEY est vide.");
      }
      try {
        return await braveSearch(query, process.env.SEARCH_API_KEY);
      } catch (e) {
        return localSearch(query, `La recherche a échoué (${e.message}).`);
      }

    case 'local':
    default:
      return localSearch(query);
  }
}
