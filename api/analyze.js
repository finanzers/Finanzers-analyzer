export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let ticker;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    ticker = body?.ticker;
  } catch(e) {
    return res.status(400).json({ error: 'Body inválido' });
  }

  if (!ticker) return res.status(400).json({ error: 'Ticker requerido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  const prompt = `Eres el analista de Finanzers. Tu perfil: empleado de banca con pasión por los mercados. Aprendiste invirtiendo y perdiendo dinero real. Valoras el tiempo libre por encima del dinero. Anti-gurú, anti-postureo. Hablas como un amigo que sabe más que tú de esto.

Tu estilo: directo, frases cortas, sin palabrería, honesto, opinión fuerte con argumento.

Busca las noticias más recientes sobre la acción ${ticker} y genera un informe.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra):
{
  "ticker": "${ticker}",
  "company": "nombre completo",
  "sentimentScore": número 0-100,
  "momentumScore": número 0-100,
  "riskScore": número 0-100,
  "verdict": "hook brutal en máximo 15 palabras",
  "analysis": "3-4 párrafos cortos separados por salto de línea. Datos concretos.",
  "news": [
    {"headline": "titular real reciente", "source": "fuente", "sentiment": "positive|negative|neutral"},
    {"headline": "titular", "source": "fuente", "sentiment": "positive|negative|neutral"},
    {"headline": "titular", "source": "fuente", "sentiment": "positive|negative|neutral"},
    {"headline": "titular", "source": "fuente", "sentiment": "positive|negative|neutral"}
  ],
  "catalysts": [
    {"type": "bull", "text": "catalizador alcista concreto"},
    {"type": "bull", "text": "catalizador alcista concreto"},
    {"type": "bear", "text": "riesgo bajista concreto"},
    {"type": "bear", "text": "riesgo bajista concreto"}
  ],
  "opinion": "2 párrafos. Mi opinión personal honesta sobre qué haría con esta acción ahora mismo.",
  "question": "Pregunta de engagement con <span> alrededor del ticker"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No se pudo parsear la respuesta' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
