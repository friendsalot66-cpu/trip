import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for Server-Side API Key
  // The API key must be obtained exclusively from the environment variable process.env.API_KEY
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Server Error: API_KEY is missing.");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { model, contents, config } = req.body;

    // Initialize SDK with server-side key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Call the model
    // Note: We use the generic generateContent which handles both text and object responses
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: contents,
      config: config
    });

    // Return the text content directly
    return res.status(200).json({ 
      text: response.text 
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ 
      error: 'Failed to generate content',
      details: error.message 
    });
  }
}