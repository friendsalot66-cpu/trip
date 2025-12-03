// geminiService.ts (改成 perplexityService.ts 或保留原名)
import { Place, DayItinerary } from "../types";

// 讀取環境變數 (Perplexity Key)
const apiKey = import.meta.env.VITE_API_KEY || "";

// Perplexity API 設定
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
// 使用具備搜尋能力的模型，適合找地點
const SEARCH_MODEL = "sonar"; 
// 使用具備推理能力的模型，適合排行程 (或是用 sonar-pro / r1-1776)
const REASONING_MODEL = "sonar-pro"; 

/**
 * 通用 Fetch 函式處理 Perplexity API 呼叫
 */
async function callPerplexity(
  messages: any[],
  model: string,
  jsonMode: boolean = false
): Promise<string> {
  if (!apiKey) throw new Error("API Key is missing");

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const body: any = {
    model: model,
    messages: messages,
    // 如果模型支援 response_format，可以加上；目前 sonar 系列建議靠 prompt 強制
    // response_format: jsonMode ? { type: "json_object" } : undefined 
  };

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 輔助函式：清理 JSON 字串 (Perplexity 有時會多講話)
 */
function cleanJsonString(text: string): string {
  let cleaned = text.replace(/``````/g, '').trim();
  const firstOpen = cleaned.indexOf('{');
  const firstArray = cleaned.indexOf('[');
  
  // 判斷是物件還是陣列開始得早
  let start = -1;
  if (firstOpen !== -1 && (firstArray === -1 || firstOpen < firstArray)) start = firstOpen;
  else if (firstArray !== -1) start = firstArray;

  const lastClose = cleaned.lastIndexOf('}');
  const lastArrayClose = cleaned.lastIndexOf(']');
  
  let end = -1;
  if (lastClose !== -1 && (lastArrayClose === -1 || lastClose > lastArrayClose)) end = lastClose;
  else if (lastArrayClose !== -1) end = lastArrayClose;

  if (start !== -1 && end !== -1) {
    return cleaned.substring(start, end + 1);
  }
  return cleaned;
}


/**
 * Search for places
 */
export const findPlacesWithAI = async (query: string, currentCenter?: { lat: number, lng: number }): Promise<Partial<Place>[]> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return mockGeoCodingList(query, currentCenter);
  }

  try {
    const systemPrompt = `
      You are a helpful travel assistant using real-time search data.
      User is looking for places near Lat: ${currentCenter?.lat || "N/A"}, Lng: ${currentCenter?.lng || "N/A"}.
      
      Task:
      1. If the query is a specific place, return its details.
      2. If it's a category, find 3-5 highly rated real-world recommendations.
      
      CRITICAL: Return ONLY valid JSON. No markdown blocks. No intro text.
      Structure:
      {
        "candidates": [
          { "name": "Name", "lat": 0.0, "lng": 0.0, "address": "Addr", "remarks": "Why good" }
        ]
      }
    `;

    const content = await callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      SEARCH_MODEL // 用 sonar 才有聯網搜尋能力找地點
    );

    const jsonText = cleanJsonString(content);
    const parsed = JSON.parse(jsonText);
    return (parsed.candidates || []).filter((c: any) => c.lat && c.lng);

  } catch (error) {
    console.error("AI Place Search Error:", error);
    return [];
  }
};

/**
 * Itinerary Generation
 */
export const generateItineraryWithAI = async (prompt: string, daysCount: number): Promise<DayItinerary[]> => {
  try {
    const systemPrompt = `
      You are an expert travel planner. Create a ${daysCount}-day itinerary.
      The response MUST be a valid JSON array. No markdown.
      
      Format:
      [
        {
          "dayId": "day-1", "title": "Day 1 Title",
          "places": [
            { "name": "Place", "lat": 0.0, "lng": 0.0, "remarks": "Desc", "address": "Addr", "type": "activity", "time": "09:00" }
          ]
        }
      ]
      type must be: "activity", "flight", "hotel".
    `;

    const content = await callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      REASONING_MODEL // 用 sonar-pro 或 r1 推理能力較好
    );

    const jsonText = cleanJsonString(content);
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
 * Optimize Route
 */
export const optimizeItineraryWithAI = async (
  currentItinerary: DayItinerary[], 
  scope: 'day' | 'trip', 
  activeDayId: string,
  constraints: string
): Promise<DayItinerary[]> => {
  
  const itineraryContext = currentItinerary.map(d => ({
    dayId: d.dayId,
    title: d.title,
    places: d.places.map(p => ({
      name: p.name, lat: p.lat, lng: p.lng, time: p.time
    }))
  }));

  const systemPrompt = `
    Optimize this travel route. Scope: ${scope}. Constraints: ${constraints}.
    Return ONLY the updated JSON array of DayItinerary (same structure as input).
    Do not change IDs or names, just reorder and update times.
  `;

  try {
    const content = await callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(itineraryContext) }
      ],
      REASONING_MODEL
    );

    const jsonText = cleanJsonString(content);
    return JSON.parse(jsonText);

  } catch (error) {
    console.error("AI Optimization Error:", error);
    throw error;
  }
}

/**
 * Parse Text
 */
export const parseItineraryFromText = async (text: string): Promise<any> => {
  const systemPrompt = `
    Parse this text into a travel itinerary JSON.
    Schema: { "destination": "", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": [...] }
    Estimate Lat/Lng for places.
  `;

  try {
    const content = await callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      REASONING_MODEL
    );

    const jsonText = cleanJsonString(content);
    const parsedData = JSON.parse(jsonText);
    
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
    console.error("AI Parse Error:", error);
    throw error;
  }
};

const mockGeoCodingList = (query: string, center?: { lat: number, lng: number }): Partial<Place>[] => {
   // Mock implementation (same as before)
   return []; 
};
