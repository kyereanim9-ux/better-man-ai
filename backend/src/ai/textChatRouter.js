import { TEXT_AI_PROVIDERS } from '../config/textProviders.js';

// Compteurs en mémoire, même esprit que ai/aiRouter.js (vision) — remis à
// zéro à chaque redémarrage, indicateur honnête plutôt qu'un quota exact
// impossible à connaître sans interroger chaque fournisseur.
export const textProviderStats = {};
function ensureStats(id) {
  textProviderStats[id] ??= { requestsToday: 0, errors: 0, lastUsedAt: null, lastError: null };
  return textProviderStats[id];
}

class AllProvidersFailedError extends Error {
  constructor(attempts) {
    super('Tous les fournisseurs IA texte ont échoué');
    this.name = 'AllProvidersFailedError';
    this.attempts = attempts;
  }
}

async function callProvider(provider, messages) {
  const apiKey = process.env[provider.apiKeyEnvVar];
  if (!apiKey) throw new Error(`Clé API manquante (${provider.apiKeyEnvVar})`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: provider.model, messages, max_tokens: 400 }),
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Réponse vide ou format inattendu');
    return content;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Délai dépassé (15s).');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// Essaie chaque fournisseur configuré dans l'ordre jusqu'à ce que l'un
// réponde ; ne lève une erreur que si TOUS échouent (ou aucun n'est
// configuré) — l'appelant (chat/routes.js) bascule alors sur le coach local.
export async function chatWithFallback(messages, providers = TEXT_AI_PROVIDERS) {
  const withKey = providers.filter(p => process.env[p.apiKeyEnvVar]);
  const attempts = [];

  for (const provider of withKey) {
    const stats = ensureStats(provider.id);
    try {
      const content = await callProvider(provider, messages);
      stats.requestsToday++;
      stats.lastUsedAt = new Date().toISOString();
      return { content, providerUsed: provider.name };
    } catch (err) {
      stats.errors++;
      stats.lastError = err.message;
      attempts.push({ provider: provider.name, error: err.message });
      // Journalisé en clair pour pouvoir diagnostiquer via les logs Render —
      // sans ça, l'échec était invisible même côté serveur.
      console.error(`[chat IA texte] ${provider.name} a échoué : ${err.message}`);
    }
  }

  throw new AllProvidersFailedError(attempts);
}

export function getTextProviderStatus() {
  return TEXT_AI_PROVIDERS.map(p => ({
    id: p.id, name: p.name, model: p.model,
    configured: !!process.env[p.apiKeyEnvVar],
    ...ensureStats(p.id)
  }));
}
