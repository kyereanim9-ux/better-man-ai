import { CLAUDE_MODEL } from '../ai/providers/claude.js';
import { GEMINI_MODEL } from './geminiModel.js';

/**
 * Fournisseurs LLM texte gratuits, dans l'ordre de priorité — distinct de
 * config/aiProviders.js (qui gère la VISION/image). Utilisé pour le Coach IA
 * conversationnel (texte seul), avec repli sur le coach local si aucun
 * fournisseur n'est configuré ou si tous échouent.
 *
 * Chaque fournisseur expose une API compatible OpenAI
 * (POST {baseUrl}/chat/completions), ce qui permet un fallback uniforme.
 * Basé sur https://github.com/mnfst/awesome-free-llm-apis (liste
 * communautaire de fournisseurs gratuits maintenue à jour).
 *
 * Exception : Claude (Anthropic), payant à l'usage, passe par le SDK officiel
 * (ai/providers/claude.js) au lieu de l'API compatible OpenAI. Il est essayé
 * en premier quand ANTHROPIC_API_KEY est renseignée.
 *
 * Ajoute les clés correspondantes dans les variables d'environnement :
 *   ANTHROPIC_API_KEY= (payant — https://console.anthropic.com)
 *   GEMINI_API_KEY=    (déjà utilisée pour la vision — réutilisée ici)
 *   MISTRAL_API_KEY=
 *   COHERE_API_KEY=
 *   ZAI_API_KEY=
 */
export const TEXT_AI_PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    sdk: 'anthropic',
    model: CLAUDE_MODEL,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: GEMINI_MODEL,
    apiKeyEnvVar: 'GEMINI_API_KEY'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    apiKeyEnvVar: 'MISTRAL_API_KEY'
  },
  {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/v2',
    model: 'command-r',
    apiKeyEnvVar: 'COHERE_API_KEY'
  },
  {
    id: 'zai',
    name: 'Z AI (Zhipu)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.5-flash',
    apiKeyEnvVar: 'ZAI_API_KEY'
  }
];
