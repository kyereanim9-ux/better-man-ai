// Ollama (https://ollama.com) permet de faire tourner un vrai modèle de
// langage en local, gratuitement, sans clé API et sans envoyer de données à
// l'extérieur. Prérequis sur la machine qui héberge Better Man AI :
//   1. Installer Ollama (https://ollama.com/download)
//   2. Télécharger un modèle : `ollama pull llama3.2` (ou un autre modèle)
//   3. Laisser Ollama tourner (il écoute par défaut sur http://localhost:11434)
// Aucun coût, mais demande un peu de RAM/CPU (ou GPU) selon le modèle choisi.
export async function ollamaReply(messages, context = {}) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const systemPrompt =
    "Tu es un coach personnel bienveillant et direct, dans une application de développement personnel. " +
    "Aide la personne à réfléchir avant d'agir, reste concret, ne décide jamais à sa place. " +
    "Reste bref (quelques phrases). Réponds en français.";

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama a répondu avec le statut ${response.status}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() || '';
}
