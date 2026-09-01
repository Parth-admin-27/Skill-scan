const Groq = require('groq-sdk');
require('dotenv').config();
const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;
const prompt = `Analyze this resume. Return ONLY valid JSON, no extra text:
{"overallScore":0-100,"scoreLabel":"short label","strengths":["3 items"],"improvements":["3 items"],"currentSkills":["list"],"missingSkills":["list for detected role"],"targetRole":"role name","roadmap":[{"step":1,"title":"t","description":"d"}],"aiSuggestions":["4 items"]}

Resume:
John Doe
Software Engineer with 5 years experience in React and Node.js.
`;

async function callGroqWithFallback(request) {
  if (!groq) {
    throw new Error('Groq API key is not configured');
  }

  const models = [process.env.GROQ_MODEL, 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'groq/compound', 'groq/compound-mini'].filter(Boolean);

  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      return await groq.chat.completions.create({ ...request, model });
    } catch (error) {
      const message = error?.message || '';
      const isModelMissing = error?.status === 404 || error?.code === 'model_not_found' || /does not exist|not found|model.*invalid/i.test(message);
      if (isModelMissing) {
        console.warn(`Model unavailable: ${model}, trying next option.`);
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('No Groq model available for the request');
}

async function run() {
  const completion = await callGroqWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1200
  });
  const text = completion.choices[0].message.content.trim();
  console.log('TEXT:', text);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) console.log('INVALID FORMAT');
  else console.log('PARSED:', JSON.parse(match[0]));
}
run().catch(console.error);
