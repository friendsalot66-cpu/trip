import { Place, DayItinerary, PlaceType } from "../types";

// Helper function to call our Next.js API route
async function callAiApi(task: string, payload: any) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task, payload }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `API call for task '${task}' failed`);
  }
  return response.json();
}


/**
 * Search for places using the backend AI service
 */
export const findPlacesWithAI = async (query: string, currentCenter?: { lat: number, lng: number }): Promise<Partial<Place>[]> => {
  try {
    const json = await callAiApi('findPlaces', { query, currentCenter });
    return json.candidates || [];
  } catch (error) {
    console.error("AI Search Error:", error);
    return [];
  }
};

/**
 * Generate Full Itinerary
 */
export const generateItineraryWithAI = async (prompt: string, daysCount: number): Promise<DayItinerary[]> => {
    // This task is complex and the prompt was highly specific to Gemini's schema.
    // Replicating this with a generic API is non-trivial.
    // For now, we will throw an error, as this functionality is not supported with the new API
    console.warn("generateItineraryWithAI is not supported in this version.");
    throw new Error("Generating a full itinerary with AI is not currently supported.");
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
  try {
    const optimized = await callAiApi('optimizeItinerary', { currentItinerary, scope, activeDayId, constraints });
    
    // Re-add client-side IDs which might be stripped by the AI
    return optimized.map((day: any) => ({
        ...day,
        places: day.places.map((p: any) => ({
            ...p,
            id: crypto.randomUUID(),
            type: p.type as PlaceType || 'activity'
        }))
    }));
  } catch (error) {
    console.error("AI Optimization Error:", error);
    throw error;
  }
};

/**
 * Parse Text to Itinerary
 */
export const parseItineraryFromText = async (text: string): Promise<{ destination: string, startDate: string, endDate: string, days: DayItinerary[] }> => {
  try {
    const parsed = await callAiApi('parseItineraryFromText', { text });
    
    // Add client-side IDs
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
    console.error("AI Parsing Error:", error);
    throw error;
  }
};

/**
 * Calculate Travel Times
 */
export const calculateTravelTimes = async (places: Place[]): Promise<Place[]> => {
  if (places.length < 2) return places;

  try {
     const json = await callAiApi('calculateTravelTimes', { places });
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
 * Get Stopover Recommendations
 */
export const getStopoverRecommendations = async (from: Place, to: Place): Promise<Partial<Place>[]> => {
    try {
        const json = await callAiApi('getStopoverRecommendations', { from, to });
        return json.candidates || [];
    } catch (e) {
        console.error("Stopover Error:", e);
        return [];
    }
}

/**
 * Generate Markdown Export (No AI needed)
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
