export async function chatWithImageGemini({ systemPrompt, messages, imageDataUrl, model, apiKey }) {
  const contents = [];
  let imageAttached = false;

  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const parts = [{ text: m.content }];
    if (m.role === 'user' && !imageAttached && imageDataUrl) {
      const match = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (match) {
        parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        imageAttached = true;
      }
    }
    contents.push({ role, parts });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents
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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini a répondu avec le statut ${res.status}${body ? ` (${body.slice(0, 150)})` : ''}`);
  }
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Gemini a répondu sans contenu exploitable.');
  return { reply: reply.trim(), modelUsed: model };
}
