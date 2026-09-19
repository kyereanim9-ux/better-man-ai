import { parseAnalysisJson } from './geminiProvider.js';

// Alternative si l'utilisateur a déjà (ou préfère) une clé API Anthropic.
// Payant à l'usage, mais très bon marché pour une image ponctuelle.
export async function analyzeFoodPhotoAnthropic(photoDataUrl, description, apiKey) {
  const match = photoDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error('Format de photo invalide.');
  const [, mimeType, base64Data] = match;

  const prompt = `Tu regardes une photo d'un repas. L'utilisateur a décrit ce qu'il mange ainsi : "${description || '(pas de description fournie)'}".
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{"foods": ["aliment identifié 1", "aliment identifié 2"], "estimatedCalories": nombre_approximatif, "macroNote": "phrase courte sur protéines/glucides/lipides approximatifs", "confidence": "faible"|"moyenne"|"élevée"}
Reste prudent : donne un ordre de grandeur, pas une valeur exacte impossible à garantir depuis une photo.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic a répondu avec le statut ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseAnalysisJson(text);
}
