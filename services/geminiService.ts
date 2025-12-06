import { GoogleGenAI, Type } from "@google/genai";
import { Place, DayItinerary, PlaceType } from "../types";

// Initialize Gemini AI Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to clean Markdown from JSON string (e.g. ```json ... ```)
const cleanJson = (text: string) => {
  if (!text) return "{}";
  // Remove markdown code blocks
  return text.replace(/```json\s*|\s*```/g, "").trim();
};

/**
 * Search for places using Gemini
 */
export const findPlacesWithAI = async (query: string, currentCenter?: { lat: number, lng: number }): Promise<Partial<Place>[]> => {
  const prompt = `
    Task: Search for real-world places based on the query: "${query}".
    Location Context: Near Lat ${currentCenter?.lat}, Lng ${currentCenter?.lng}.
    
    Instructions:
    1. Find 3-5 real places matching the query.
    2. You MUST provide estimated Latitude and Longitude for each place.
    3. If the query is ambiguous, suggest the most popular relevant locations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  address: { type: Type.STRING },
                  remarks: { type: Type.STRING },
                },
                required: ['name', 'lat', 'lng'],
              },
            },
          },
        },
      },
    });

    const json = JSON.parse(cleanJson(response.text || "{}"));
    return json.candidates || [];
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};

/**
 * Generate Full Itinerary
 */
export const generateItineraryWithAI = async (prompt: string, daysCount: number): Promise<DayItinerary[]> => {
  const userPrompt = `
    Request: "${prompt}"
    
    Requirements:
    1. Organize into exactly ${daysCount} days.
    2. Provide realistic coordinates (lat/lng) for every place.
    3. Ensure logical flow and order.
    4. Return a JSON array of day objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: {
        responseMimeType: 'application/json',
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
                    type: { type: Type.STRING, description: "One of 'activity', 'flight', 'hotel'" },
                    time: { type: Type.STRING },
                  },
                  required: ['name', 'lat', 'lng', 'type'],
                },
              },
            },
            required: ['dayId', 'title', 'places'],
          },
        },
      },
    });

    const rawData = JSON.parse(cleanJson(response.text || "[]"));

    // Post-process to ensure IDs exist
    return rawData.map((day: any, index: number) => ({
      ...day,
      dayId: day.dayId || `day-${index + 1}`,
      places: day.places.map((p: any) => ({
        ...p,
        id: crypto.randomUUID(),
        type: p.type || 'activity'
      }))
    }));
  } catch (error) {
    console.error("Gemini Planning Error:", error);
    throw error;
  }
};

/**
 * Optimize Itinerary
 */
export const optimizeItineraryWithAI = async (
  currentItinerary: DayItinerary[], 
  scope: 'day' | 'trip', 
  activeDayId: string,
  constraints: string
): Promise<DayItinerary[]> => {
  
  const userPrompt = `
    You are a logistics expert. Optimize the itinerary order.
    Scope: ${scope === 'day' ? `Only optimize dayId: ${activeDayId}` : "Optimize entire trip"}
    Constraints: ${constraints || "Minimize travel time"}
    
    Input JSON:
    ${JSON.stringify(currentItinerary.map(d => ({
      dayId: d.dayId,
      title: d.title,
      date: d.date,
      places: d.places.map(p => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        type: p.type,
        time: p.time,
        remarks: p.remarks
      }))
    })))}

    Return the EXACT same JSON structure (Array of DayItinerary) but with reordered places.
    Do not remove places.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayId: { type: Type.STRING },
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              places: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                    remarks: { type: Type.STRING },
                    type: { type: Type.STRING },
                    time: { type: Type.STRING },
                  },
                  required: ['name', 'lat', 'lng'],
                },
              },
            },
            required: ['dayId', 'places'],
          },
        },
      },
    });

    const optimized = JSON.parse(cleanJson(response.text || "[]"));
    
    // We re-add IDs just in case they were stripped to save context window
    return optimized.map((day: any) => ({
        ...day,
        places: day.places.map((p: any) => ({
            ...p,
            id: crypto.randomUUID(),
            type: p.type as PlaceType || 'activity'
        }))
    }));
  } catch (error) {
    console.error("Gemini Optimization Error:", error);
    throw error;
  }
};

/**
 * Parse Text to Itinerary
 */
export const parseItineraryFromText = async (text: string): Promise<{ destination: string, startDate: string, endDate: string, days: DayItinerary[] }> => {
  const userPrompt = `
    Task: Parse structured travel data from the text below.
    
    Raw Text:
    "${text}"
    
    Instructions:
    1. Parse dates, times, and places.
    2. Estimate coordinates (lat/lng) for every place based on the city name.
    3. If year is missing, assume upcoming travel dates.
    4. Return JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            destination: { type: Type.STRING },
            startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
            endDate: { type: Type.STRING, description: "YYYY-MM-DD" },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  date: { type: Type.STRING, description: "YYYY-MM-DD" },
                  places: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER },
                        remarks: { type: Type.STRING },
                        type: { type: Type.STRING, description: "One of 'activity', 'hotel', 'flight'" },
                        time: { type: Type.STRING },
                      },
                      required: ['name', 'lat', 'lng'],
                    },
                  },
                },
                required: ['dayId', 'places'],
              },
            },
          },
          required: ['destination', 'startDate', 'endDate', 'days'],
        },
      },
    });

    const parsed = JSON.parse(cleanJson(response.text || "{}"));
    
    // Add IDs
    if (parsed.days) {
      parsed.days = parsed.days.map((day: any, idx: number) => ({
        ...day,
        dayId: day.dayId || `day-${idx + 1}`,
        places: day.places.map((p: any) => ({
          ...p,
          id: crypto.randomUUID(),
          type: p.type || 'activity'
        }))
      }));
    }

    return parsed;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw error;
  }
};

/**
 * NEW: Calculate Travel Times
 * Estimates driving time between a sequence of places.
 */
export const calculateTravelTimes = async (places: Place[]): Promise<Place[]> => {
  if (places.length < 2) return places;

  const prompt = `
    Task: Estimate driving time between sequential locations.
    
    Locations Sequence:
    ${places.map((p, i) => `${i + 1}. ${p.name} (Lat: ${p.lat}, Lng: ${p.lng})`).join('\n')}
    
    Output:
    Return a JSON array of strings representing the estimated travel time to get TO that place from the PREVIOUS one.
    Index 0 should be null (start).
    Index 1 is time from 1->2.
    Format: "15 min", "1 hr 20 min", etc.
  `;

  try {
     const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    times: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING, nullable: true }
                    }
                }
            }
        }
     });

     const json = JSON.parse(cleanJson(response.text || "{}"));
     const times = json.times || [];

     return places.map((p, i) => ({
         ...p,
         travelTime: i > 0 && times[i] ? times[i] : undefined
     }));

  } catch (e) {
      console.error("Travel Time Est Error:", e);
      return places; // Return original on error
  }
};

/**
 * NEW: Get Stopover Recommendations
 */
export const getStopoverRecommendations = async (from: Place, to: Place): Promise<Partial<Place>[]> => {
    const prompt = `
        Task: Recommend 3 interesting stopover places between "${from.name}" and "${to.name}".
        Context: Traveling from Lat ${from.lat}, Lng ${from.lng} to Lat ${to.lat}, Lng ${to.lng}.
        
        Output: JSON Array of Place objects (name, lat, lng, address, remarks).
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidates: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    lat: { type: Type.NUMBER },
                                    lng: { type: Type.NUMBER },
                                    address: { type: Type.STRING },
                                    remarks: { type: Type.STRING },
                                },
                                required: ['name', 'lat', 'lng']
                            }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(cleanJson(response.text || "{}"));
        return json.candidates || [];
    } catch (e) {
        console.error("Stopover Error:", e);
        return [];
    }
}

/**
 * NEW: Generate Markdown Export
 */
export const generateMarkdown = (tripTitle: string, days: DayItinerary[]): string => {
    let md = `# ${tripTitle}\n\n`;
    
    days.forEach(day => {
        md += `## ${day.title} (${day.date})\n`;
        day.places.forEach((place, idx) => {
            const time = place.time ? `**${place.time}** ` : '';
            const travel = place.travelTime ? `\n   *🚗 Travel: ${place.travelTime}*` : '';
            const expense = place.expenses ? `\n   *💰 Expense: ${place.expenses.currency} ${place.expenses.amount}*` : '';
            md += `${idx + 1}. ${time}${place.name} (${place.type})\n   ${place.remarks || ''}${travel}${expense}\n\n`;
        });
        md += `---\n\n`;
    });
    return md;
}
