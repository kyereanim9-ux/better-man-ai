// Configuration centrale : un seul endroit à modifier pour changer de
// fournisseur, de modèle, de priorité, ou activer/désactiver.
// Ne JAMAIS coder de nom de modèle ailleurs que dans ce fichier + les
// fichiers providers/ correspondants.
//
// Modèle OpenRouter : "openrouter/free" plutôt qu'un modèle précis —
// c'est le routeur automatique d'OpenRouter lui-même, qui sélectionne un
// modèle gratuit compatible image à chaque requête. La liste des modèles
// gratuits individuels change en permanence (vérifié en cherchant les
// infos à jour) ; ce choix évite de coder en dur un identifiant qui aura
// disparu dans quelques mois.
export const AI_MODE = process.env.AI_MODE || 'FREE'; // 'FREE' ou 'PAID' (PAID jamais activé automatiquement)

export const AI_PROVIDERS = [
  {
    key: 'openrouter',
    label: 'OpenRouter',
    priority: 1,
    free: true,
    vision: true,
    active: true,
    model: 'openrouter/free',
    envKey: 'OPENROUTER_API_KEY'
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    priority: 2,
    free: true,
    vision: true,
    active: true,
    model: 'gemini-1.5-flash',
    envKey: 'GEMINI_API_KEY'
  }
  // Hugging Face : prévu (voir ROADMAP.md), pas encore branché dans cette
  // version — les modèles vision-language gratuits et stables sur
  // Hugging Face Inference sont plus rares et changent souvent de statut ;
  // à ajouter ici avec key: 'huggingface' quand un modèle fiable est choisi.
];

export function getActiveProviders() {
  return AI_PROVIDERS
    .filter(p => p.active && (AI_MODE === 'PAID' || p.free))
    .sort((a, b) => a.priority - b.priority);
}
