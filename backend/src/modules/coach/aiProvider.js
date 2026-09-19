// Interface commune que doit respecter tout provider IA.
// Pour brancher un nouveau service (payant ou non) plus tard :
// 1. Crée un fichier providers/monProvider.js qui exporte une fonction
//    async reply(messages, context) -> string
// 2. Ajoute-le dans le switch ci-dessous
// 3. Change AI_PROVIDER dans .env
// Aucune autre partie de l'application n'a besoin de changer.

import { localProviderReply } from './providers/localProvider.js';
import { ollamaReply } from './providers/ollamaProvider.js';

export async function getCoachReply(messages, context) {
  const provider = process.env.AI_PROVIDER || 'local';

  switch (provider) {
    case 'local':
      return localProviderReply(messages, context);

    case 'ollama':
      try {
        return await ollamaReply(messages, context);
      } catch (e) {
        return (await localProviderReply(messages, context)) +
          `\n\n(Note : AI_PROVIDER=ollama mais la connexion a échoué — ${e.message}. Vérifie qu'Ollama tourne bien sur cette machine. Réponse générée en mode local à la place.)`;
      }

    case 'anthropic': {
      if (!process.env.ANTHROPIC_API_KEY) {
        return (await localProviderReply(messages, context)) +
          "\n\n(Note: AI_PROVIDER=anthropic mais ANTHROPIC_API_KEY est vide, réponse générée en mode local.)";
      }
      // Exemple d'intégration future avec l'API Anthropic.
      // Décommente et adapte quand une clé API sera disponible.
      /*
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages
        })
      });
      const data = await res.json();
      return data.content?.[0]?.text || '';
      */
      return localProviderReply(messages, context);
    }

    default:
      return localProviderReply(messages, context);
  }
}
