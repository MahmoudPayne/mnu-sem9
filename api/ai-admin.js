module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing in Vercel' });
    }

    const idToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!idToken) {
      return res.status(401).json({ error: 'Missing admin token' });
    }

    // التحقق من الأدمن
    const authRes = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyB40UfePbJ64NybvNLtR6I351fcAprc0KY',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );
    const authData = await authRes.json();
    if (authData?.users?.[0]?.email !== '22010255@gmail.com') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const promptText = (body.promptText || '').trim();
    if (!promptText) {
      return res.status(400).json({ error: 'Empty input' });
    }

    const systemPrompt = `أنت مساعد ذكي لإدارة منصة طبية (MNU Med Sem 9). المواد: OPTH, ENT, FMIMC, EBMR.
أعد JSON صافي فقط بهذا الشكل الدقيق:
{
  "action": "quiz" | "resource" | "notification",
  "subject": "OPTH" | "ENT" | "FMIMC" | "EBMR",
  "resource": { "title": "", "url": "", "desc": "" },
  "questions": [
    { "question": "", "options": ["", "", "", ""], "correct": 0, "explanation": "" }
  ],
  "notification": { "title": "", "body": "", "priority": "normal" }
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nطلب الأدمن:\n${promptText}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!geminiRes.ok || !rawText) {
      return res.status(502).json({ error: geminiData?.error?.message || 'Gemini API error' });
    }

    const cleaned = rawText.replace(/```json\s*|```/gi, '').trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
