// Fournisseur Claude (Anthropic) pour le Coach IA texte, via le SDK officiel.
// Payant à l'usage : une clé API se crée sur https://console.anthropic.com
// (facturation séparée de l'abonnement Claude.ai). Sans ANTHROPIC_API_KEY,
// textChatRouter.js ignore ce fournisseur et passe aux suivants (gratuits).
import Anthropic from '@anthropic-ai/sdk';

// Modèle modifiable sans toucher au code (variable CLAUDE_MODEL).
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

let client = null;
function getClient() {
  // timeout en millisecondes ; une seule relance pour ne pas faire attendre
  // l'utilisateur trop longtemps avant le repli sur les autres fournisseurs.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45000, maxRetries: 1 });
  return client;
}

// `messages` arrive au format OpenAI ({role: system|user|assistant, content}).
// L'API Anthropic attend le prompt système à part, et une conversation qui
// commence par un message utilisateur.
export async function claudeChat(messages) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const turns = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .map(m => ({ role: m.role, content: m.content }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length) throw new Error('Aucun message utilisateur à envoyer');

  const response = await getClient().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: `${system}\n\nLatency-sensitive; begin your visible answer immediately.`,
    messages: turns,
    // Conversation de coaching : effort bas = réponses rapides et moins chères.
    output_config: { effort: 'low' },
    // Si un filtre de sécurité refuse la demande, l'API la relance d'elle-même
    // sur le modèle de repli recommandé par Anthropic.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default'
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Demande refusée par Claude (${response.stop_details?.category || 'sans catégorie'})`);
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) throw new Error(`Réponse vide (stop_reason: ${response.stop_reason})`);
  return text;
}
