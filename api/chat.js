export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-shadow-token');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, context, pref } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // المفتاح بيجي من Environment Variables في Vercel
  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  // بناء الرسائل مع السياق
  const systemPrompt = `أنت Shadow AI، مساعد ذكي داخل تطبيق "نظام الظل" لتطوير الذات.
تتكلم بالعربي بأسلوب ودود ومباشر.
${pref ? '\nتفضيلات المستخدم: ' + pref : ''}
${context ? '\nملخص تقدم المستخدم: ' + JSON.stringify(context) : ''}
ساعد المستخدم في: تحليل تقدمه، التخطيط، المذاكرة، تحسين الروتين، وإنشاء تحديات.
كن مختصراً ومفيداً.`;

  const openrouterMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.r === 'u' ? 'user' : 'assistant',
      content: String(m.t || '').slice(0, 4000)
    }))
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://shadow-system.app',
        'X-Title': 'Shadow System'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: openrouterMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      return res.status(response.status).json({ 
        error: `OpenRouter error (${response.status})` 
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    res.status(200).json({ reply: reply.slice(0, 4000) });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
