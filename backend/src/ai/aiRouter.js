import { getActiveProviders } from '../config/aiProviders.js';
import { chatWithImageOpenRouter } from './providers/openrouter.js';
import { chatWithImageGemini } from './providers/gemini.js';

// Compteurs en mémoire (remis à zéro à chaque redémarrage du serveur) —
// utilisés par le petit panneau de statut admin. Pas une garantie de quota
// exact (impossible à connaître sans interroger chaque fournisseur), juste
// un indicateur honnête de ce qui a été essayé/a échoué depuis le démarrage.
export const providerStats = {};
function ensureStats(key) {
  providerStats[key] ??= { requestsToday: 0, errors: 0, lastUsedAt: null, lastError: null };
  return providerStats[key];
}

const HANDLERS = { openrouter: chatWithImageOpenRouter, gemini: chatWithImageGemini };

// systemPrompt: texte de catégorie. messages: [{role:'user'|'assistant', content}].
// imageDataUrl: attachée uniquement au premier tour utilisateur.
export async function routeImageChat({ systemPrompt, messages, imageDataUrl }) {
  const providers = getActiveProviders();
  const withKey = providers.filter(p => process.env[p.envKey]);

  if (withKey.length === 0) {
    return {
      ok: false,
      reply: null,
      note: "Aucun fournisseur IA gratuit n'est configuré (mode local, 0 €). Ajoute OPENROUTER_API_KEY ou GEMINI_API_KEY dans les variables d'environnement pour activer l'analyse d'image."
    };
  }

  const errors = [];
  for (const provider of withKey) {
    const stats = ensureStats(provider.key);
    try {
      const handler = HANDLERS[provider.key];
      const { reply, modelUsed } = await handler({
        systemPrompt, messages, imageDataUrl,
        model: provider.model, apiKey: process.env[provider.envKey]
      });
      stats.requestsToday++;
      stats.lastUsedAt = new Date().toISOString();
      return { ok: true, reply, providerUsed: provider.key, modelUsed };
    } catch (e) {
      stats.errors++;
      stats.lastError = e.message;
      errors.push(`${provider.label} : ${e.message}`);
      console.error(`[chat IA vision] ${provider.label} a échoué : ${e.message}`);
    }
  }

  return {
    ok: false,
    reply: null,
    note: `Les services IA gratuits sont temporairement indisponibles. Réessaie plus tard. (${errors.join(' — ')})`
  };
}

export function getProviderStatus() {
  const providers = getActiveProviders();
  return providers.map(p => ({
    key: p.key, label: p.label, model: p.model, free: p.free, vision: p.vision,
    configured: !!process.env[p.envKey],
    ...ensureStats(p.key)
  }));
}
