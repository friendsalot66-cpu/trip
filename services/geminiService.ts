
import { GoogleGenAI, Type } from "@google/genai";
import { Place, DayItinerary, PlaceType } from "../types";

const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

/**
 * Search for places with multiple candidates.
 */
export const findPlacesWithAI = async (query: string, currentCenter?: { lat: number, lng: number }): Promise<Partial<Place>[]> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return mockGeoCodingList(query, currentCenter);
  }

  try {
    const prompt = `
      You are a helpful travel assistant.
      User Query: "${query}"
      Context: User is looking for places near Lat: ${currentCenter?.lat}, Lng: ${currentCenter?.lng}.

      Task:
      1. If the query is a specific place (e.g., "Eiffel Tower"), find it.
      2. If the query is a category or ambiguous (e.g., "Good Italian food", "Hiking trails", "Museums"), 
         find 3-5 HIGHLY RATED and RELEVANT recommendations nearby.

      CRITICAL OUTPUT INSTRUCTIONS:
      1. Return ONLY a valid JSON object.
      2. Do NOT use Markdown formatting.
      3. Structure:
      {
        "candidates": [
          {
            "name": "Place Name",
            "lat": 12.34567,
            "lng": 123.45678,
            "address": "Short Address",
            "remarks": "Why this is a good match / Rating info"
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    let jsonText = response.text || "";
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    const firstOpen = jsonText.indexOf('{');
    const lastClose = jsonText.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1) {
        jsonText = jsonText.substring(firstOpen, lastClose + 1);
    } else {
        return [];
    }
    
    const parsed = JSON.parse(jsonText);
    const candidates = parsed.candidates || [];

    return candidates.filter((c: any) => c.lat && c.lng && (c.lat !== 0 || c.lng !== 0));

  } catch (error) {
    console.error("AI Place Search Error:", error);
    return [];
  }
};

/**
 * Thinking Mode Itinerary Generation (Create New)
 */
export const generateItineraryWithAI = async (prompt: string, daysCount: number): Promise<DayItinerary[]> => {
  if (!apiKey) throw new Error("API Key required for AI generation");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        You are an expert travel planner. Create a detailed ${daysCount}-day itinerary based on the user's request: "${prompt}".
        
        The response MUST be a valid JSON array of DayItinerary objects.
        Do not wrap the JSON in markdown code blocks.
        
        Structure:
        [
          {
            "dayId": "day-1",
            "title": "Day 1: Title",
            "places": [
              {
                "name": "Place Name",
                "lat": 12.3456, 
                "lng": 123.4567,
                "remarks": "Description",
                "address": "Address",
                "type": "activity", 
                "time": "09:00"
              }
            ]
          }
        ]
        
        Important:
        - "type" must be one of: "activity", "flight", "hotel".
        - Ensure coordinates are real and accurate for each place.
      `,
      config: {
        thinkingConfig: {
          thinkingBudget: 32768,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayId: { type: Type.STRING },
              title: { type: Type.STRING },
              places: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                    remarks: { type: Type.STRING },
                    address: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["activity", "flight", "hotel"] },
                    time: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    });

    let jsonText = response.text || "";
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = jsonText.indexOf('[');
    const lastClose = jsonText.lastIndexOf(']');
    
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonText = jsonText.substring(firstOpen, lastClose + 1);
    }
    
    const rawData = JSON.parse(jsonText);
    
    return rawData.map((day: any) => ({
      ...day,
      places: day.places.map((p: any) => ({
        ...p,
        id: crypto.randomUUID(),
        type: p.type || 'activity'
      }))
    }));

  } catch (error) {
    console.error("AI Planning Error:", error);
    throw error;
  }
};

/**
 * Optimize Route/Path with AI
 */
export const optimizeItineraryWithAI = async (
  currentItinerary: DayItinerary[], 
  scope: 'day' | 'trip', 
  activeDayId: string,
  constraints: string
): Promise<DayItinerary[]> => {
  if (!apiKey) throw new Error("API Key required");

  // Prepare data for AI (minimize tokens by sending lighter objects if needed, but full context is good for 3-pro)
  const itineraryContext = currentItinerary.map(d => ({
    dayId: d.dayId,
    title: d.title,
    date: d.date,
    places: d.places.map(p => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      type: p.type,
      time: p.time,
      remarks: p.remarks
    }))
  }));

  const prompt = `
    You are a logistics and travel expert. 
    Task: Optimize the travel route for the following itinerary.
    
    Scope: ${scope === 'day' ? `ONLY optimize the day with dayId: "${activeDayId}". Do not move places to other days.` : "Optimize the WHOLE trip. You can move places between days to make geographical sense."}
    
    User Constraints: "${constraints || "Minimize travel time."}"
    
    Input Itinerary JSON:
    ${JSON.stringify(itineraryContext)}

    Requirements:
    1. Reorder places to create the most efficient path.
    2. Suggest realistic times in the "time" field if missing or needing update.
    3. Keep "Flight" and "Hotel" check-ins logical (usually start/end of day or fixed times).
    4. RETURN THE EXACT SAME JSON STRUCTURE (Array of DayItinerary).
    5. Do not lose any places (unless duplicates exist). Do not hallucinate new places.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Strong reasoning for TSP (Traveling Salesman Problem)
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 16000, // Medium thinking budget for optimization
        },
        responseMimeType: "application/json",
      }
    });

    let jsonText = response.text || "";
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = jsonText.indexOf('[');
    const lastClose = jsonText.lastIndexOf(']');
    
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonText = jsonText.substring(firstOpen, lastClose + 1);
    }
    
    const optimizedDays = JSON.parse(jsonText);
    return optimizedDays;

  } catch (error) {
    console.error("AI Optimization Error:", error);
    throw error;
  }
}

/**
 * Parse raw text itinerary into structured data using AI
 */
export const parseItineraryFromText = async (text: string): Promise<{ destination: string, startDate: string, endDate: string, days: DayItinerary[] }> => {
  if (!apiKey) throw new Error("API Key required");

  const prompt = `
    You are an intelligent data parser.
    Task: Convert the following raw travel itinerary text into a structured JSON object.
    
    Input Text:
    "${text}"
    
    Instructions:
    1. Extract the main Destination, Start Date (YYYY-MM-DD), and End Date (YYYY-MM-DD).
       - If the year is missing, assume the next occurrence of that date from now (e.g. 2024 or 2025).
    2. Parse the daily schedule into a list of DayItinerary objects.
    3. For each place/activity:
       - Extract the Name.
       - Extract the Time (if available).
       - Determine the Type (flight, hotel, activity).
       - Extract Remarks/Notes.
       - IMPORTANT: Use your knowledge to estimate Lat/Lng coordinates for each place (e.g. "Taipei 101" -> 25.0339, 121.5644).
    
    Output JSON Schema:
    {
      "destination": "City Name",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "days": [
        {
          "dayId": "day-1",
          "title": "Day 1 Title",
          "date": "YYYY-MM-DD",
          "places": [
            {
              "name": "Place Name",
              "lat": 12.34,
              "lng": 56.78,
              "remarks": "Notes",
              "address": "Address (optional)",
              "type": "activity",
              "time": "HH:MM"
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 16000,
        },
        responseMimeType: "application/json",
      }
    });

    let jsonText = response.text || "";
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = jsonText.indexOf('{');
    const lastClose = jsonText.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonText = jsonText.substring(firstOpen, lastClose + 1);
    }
    
    const parsedData = JSON.parse(jsonText);
    
    // Add IDs to places
    parsedData.days = parsedData.days.map((day: any) => ({
      ...day,
      places: day.places.map((p: any) => ({
        ...p,
        id: crypto.randomUUID(),
        type: p.type || 'activity'
      }))
    }));

    return parsedData;

  } catch (error) {
    console.error("AI Text Parse Error:", error);
    throw error;
  }
};

const mockGeoCodingList = (query: string, center?: { lat: number, lng: number }): Partial<Place>[] => {
  const baseLat = center?.lat || 25.0330;
  const baseLng = center?.lng || 121.5654;
  
  return [
    {
      name: `${query} (Mock Result)`,
      lat: baseLat + 0.01,
      lng: baseLng + 0.01,
      remarks: "Mock location (API Key missing)",
      address: "123 Mock St, Virtual City"
    },
    {
      name: `${query} (Mock Result 2)`,
      lat: baseLat + 0.05,
      lng: baseLng - 0.02,
      remarks: "Mock location (API Key missing)",
      address: "456 Mock Ave, Virtual City"
    }
  ];
};
