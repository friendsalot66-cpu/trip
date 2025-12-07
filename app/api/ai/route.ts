import { NextResponse } from 'next/server';

// Perplexity API is compatible with the OpenAI SDK
// For simplicity, we'll use fetch directly.
const PPLX_API_URL = 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = 'pplx-7b-online';

// Helper to clean Markdown from JSON string (e.g. ```json ... ```)
const cleanJson = (text: string) => {
  if (!text) return "{}";
  // Find the start and end of the JSON block
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1) {
      return text.substring(arrayStart, arrayEnd + 1);
    }
    return text; // Return as-is if no JSON object/array found
  }
  return text.substring(jsonStart, jsonEnd + 1);
};

async function handler(req: Request) {
  const { task, payload } = await req.json();

  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY is not set' }, { status: 500 });
  }

  let systemPrompt = "You are an expert travel assistant. Your response MUST be only the raw JSON object or array, without any markdown, comments, or other text.";
  let userPrompt = "";

  // Construct prompts based on the task from the old geminiService.ts
  switch (task) {
    case 'findPlaces':
      userPrompt = `
        Task: Search for real-world places based on the query: "${payload.query}".
        Location Context: Near Lat ${payload.currentCenter?.lat}, Lng ${payload.currentCenter?.lng}.
        
        Instructions:
        1. Find 3-5 real places matching the query.
        2. You MUST provide estimated Latitude and Longitude for each place.
        3. If the query is ambiguous, suggest the most popular relevant locations.
        
        Respond with a JSON object: { "candidates": [{ "name": string, "lat": number, "lng": number, "address": string, "remarks": string }] }
      `;
      break;

    case 'calculateTravelTimes':
      userPrompt = `
        Task: Estimate driving time between sequential locations.
        
        Locations Sequence:
        ${payload.places.map((p: any, i: number) => `${i + 1}. ${p.name} (Lat: ${p.lat}, Lng: ${p.lng})`).join('\n')}
        
        Output:
        Return a JSON object: { "times": ["null", "15 min", "1 hr 20 min", ...] }
        The array should contain strings representing the estimated travel time to get TO that place from the PREVIOUS one.
        Index 0 must be null.
      `;
      break;

    case 'getStopoverRecommendations':
      userPrompt = `
        Task: Recommend 3 interesting stopover places between "${payload.from.name}" and "${payload.to.name}".
        Context: Traveling from Lat ${payload.from.lat}, Lng ${payload.from.lng} to Lat ${payload.to.lat}, Lng ${payload.to.lng}.
        
        Output: Respond with a JSON object: { "candidates": [{ "name": string, "lat": number, "lng": number, "address": string, "remarks": string }] }
    `;
      break;
    
    case 'parseItineraryFromText':
        userPrompt = `
        Task: Parse structured travel data from the text below.
        
        Raw Text:
        "${payload.text}"
        
        Instructions:
        1. Parse dates, times, and places.
        2. Estimate coordinates (lat/lng) for every place based on the city name.
        3. If year is missing, assume upcoming travel dates.
        4. Return a single JSON object with keys "destination", "startDate", "endDate", and "days".
        The "days" key should be an array of objects, each with "dayId", "title", "date", and "places".
      `;
      break;

    case 'optimizeItinerary':
        userPrompt = `
        You are a logistics expert. Optimize the itinerary order.
        Scope: ${payload.scope === 'day' ? `Only optimize dayId: ${payload.activeDayId}` : "Optimize entire trip"}
        Constraints: ${payload.constraints || "Minimize travel time"}
        
        Input JSON:
        ${JSON.stringify(payload.currentItinerary)}

        Return the EXACT same JSON structure (Array of DayItinerary) but with reordered places.
        Do not add or remove any places.
      `;
      break;

    default:
      return NextResponse.json({ error: 'Unknown task' }, { status: 400 });
  }

  try {
    const response = await fetch(PPLX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: PPLX_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Perplexity API Error:", errorBody);
      return NextResponse.json({ error: `API request failed with status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }
    
    const cleanedJson = cleanJson(content);
    const jsonResponse = JSON.parse(cleanedJson);

    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error("Error calling Perplexity API:", error);
    return NextResponse.json({ error: 'Failed to call AI service.' }, { status: 500 });
  }
}

export { handler as POST };
