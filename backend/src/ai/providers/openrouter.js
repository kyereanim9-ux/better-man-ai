// OpenRouter expose une API compatible OpenAI. Les images sont envoyées en
// tant que data URL directement dans image_url — pas besoin de les
// re-encoder différemment du format déjà stocké côté app.
export async function chatWithImageOpenRouter({ systemPrompt, messages, imageDataUrl, model, apiKey }) {
  const chatMessages = [{ role: 'system', content: systemPrompt }];

  for (const m of messages) {
    chatMessages.push({ role: m.role, content: m.content });
  }

  // L'image n'est attachée qu'au premier message utilisateur de la session
  // (les tours suivants n'ont pas besoin de la renvoyer).
  if (imageDataUrl && chatMessages.length >= 2) {
    const firstUserIndex = chatMessages.findIndex(m => m.role === 'user');
    if (firstUserIndex !== -1) {
      const original = chatMessages[firstUserIndex].content;
      chatMessages[firstUserIndex] = {
        role: 'user',
        content: [
          { type: 'text', text: original },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://better-man-ai.onrender.com',
        'X-Title': 'Better Man AI'
      },
      body: JSON.stringify({ model, messages: chatMessages, max_tokens: 500 }),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Délai dépassé (20s).');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter a répondu avec le statut ${res.status}${body ? ` (${body.slice(0, 150)})` : ''}`);
  }
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('OpenRouter a répondu sans contenu exploitable.');
  return { reply, modelUsed: data.model || model };
}
