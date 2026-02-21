const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const MODEL = process.env.OLLAMA_MODEL || 'mistral';

async function generateResponse(prompt, profile = {}) {
  const systemPrompt = buildSystemPrompt(profile);

  const fullPrompt = `${systemPrompt}\n\nEmail à répondre:\n${prompt}\n\nGénérez une réponse professionnelle:`;

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: MODEL,
      prompt: fullPrompt,
      stream: false
    });

    return response.data.response.trim();
  } catch (error) {
    console.error('Erreur avec Ollama:', error.message);
    throw new Error('Impossible de générer la réponse avec l\'IA');
  }
}

function buildSystemPrompt(profile) {
  let prompt = 'Vous êtes un assistant IA qui génère des réponses email professionnelles. ';

  if (profile.styles) {
    const styles = profile.styles;
    if (styles.includes('Promoteur')) prompt += 'Soyez enthousiaste et motivant. ';
    if (styles.includes('Empathique')) prompt += 'Montrez de l\'empathie et de la compréhension. ';
    if (styles.includes('Travaillomane')) prompt += 'Soyez organisé et efficace. ';
    if (styles.includes('Persévérant')) prompt += 'Insistez sur la persévérance et la détermination. ';
    if (styles.includes('Rebelle')) prompt += 'Soyez créatif et non conventionnel. ';
    if (styles.includes('Rêveur')) prompt += 'Soyez visionnaire et inspirant. ';
  }

  if (profile.formality === 'tutoiement') {
    prompt += 'Utilisez le tutoiement. ';
  } else {
    prompt += 'Utilisez le vouvoiement. ';
  }

  return prompt;
}

module.exports = { generateResponse };