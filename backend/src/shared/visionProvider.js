// Interface commune pour la reconnaissance automatique de photos.
// Pour l'activer : ajoute VISION_PROVIDER=gemini (ou anthropic) et la clé
// correspondante (GEMINI_API_KEY ou ANTHROPIC_API_KEY) dans les variables
// d'environnement, puis redéploie. Sans configuration, l'app le dit
// clairement plutôt que d'inventer une reconnaissance qui n'existe pas.
import { analyzeFoodPhotoGemini } from './vision/geminiProvider.js';
import { analyzeFoodPhotoAnthropic } from './vision/anthropicVisionProvider.js';

export async function analyzeFoodPhoto(photoDataUrl, description) {
  const provider = process.env.VISION_PROVIDER || 'local';

  switch (provider) {
    case 'gemini':
      if (!process.env.GEMINI_API_KEY) {
        return { unavailable: true, note: "VISION_PROVIDER=gemini mais GEMINI_API_KEY est vide. Reconnaissance automatique indisponible." };
      }
      try {
        const result = await analyzeFoodPhotoGemini(photoDataUrl, description, process.env.GEMINI_API_KEY);
        return { unavailable: false, ...result };
      } catch (e) {
        return { unavailable: true, note: `La reconnaissance automatique a échoué (${e.message}).` };
      }

    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        return { unavailable: true, note: "VISION_PROVIDER=anthropic mais ANTHROPIC_API_KEY est vide. Reconnaissance automatique indisponible." };
      }
      try {
        const result = await analyzeFoodPhotoAnthropic(photoDataUrl, description, process.env.ANTHROPIC_API_KEY);
        return { unavailable: false, ...result };
      } catch (e) {
        return { unavailable: true, note: `La reconnaissance automatique a échoué (${e.message}).` };
      }

    case 'local':
    default:
      return {
        unavailable: true,
        note: "Aucune reconnaissance automatique configurée (mode local, 0 €). Configure VISION_PROVIDER=gemini (gratuit, clé sur aistudio.google.com/apikey) ou VISION_PROVIDER=anthropic dans les variables d'environnement pour l'activer."
      };
  }
}
