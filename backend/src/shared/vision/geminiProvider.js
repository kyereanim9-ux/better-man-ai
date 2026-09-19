// Google Gemini a un palier gratuit généreux (Gemini Flash), adapté à
// l'esprit "0€ pour commencer" du projet. Clé gratuite sur
// https://aistudio.google.com/apikey
export async function analyzeFoodPhotoGemini(photoDataUrl, description, apiKey) {
  const match = photoDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error('Format de photo invalide.');
  const [, mimeType, base64Data] = match;

  const prompt = `Tu regardes une photo d'un repas. L'utilisateur a décrit ce qu'il mange ainsi : "${description || '(pas de description fournie)'}".
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{"foods": ["aliment identifié 1", "aliment identifié 2"], "estimatedCalories": nombre_approximatif, "macroNote": "phrase courte sur protéines/glucides/lipides approximatifs", "confidence": "faible"|"moyenne"|"élevée"}
Reste prudent : donne un ordre de grandeur, pas une valeur exacte impossible à garantir depuis une photo.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        }),
        signal: controller.signal
      }
    );
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Délai dépassé (20s).');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Gemini a répondu avec le statut ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAnalysisJson(text);
}

export function parseAnalysisJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
      estimatedCalories: typeof parsed.estimatedCalories === 'number' ? parsed.estimatedCalories : null,
      macroNote: parsed.macroNote || '',
      confidence: parsed.confidence || 'moyenne'
    };
  } catch {
    return { foods: [], estimatedCalories: null, macroNote: text.slice(0, 300), confidence: 'faible' };
  }
}

