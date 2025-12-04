import { Place, DayItinerary, PlaceType } from "../types";

/**
 * ============================================================
 *  PERPLEXITY AI SERVICE (Replacing Gemini)
 * ============================================================
 * 
 * 注意：我們保留了原本的檔名 geminiService.ts 以避免破壞專案結構。
 * 但底層邏輯已經切換為 Perplexity (Sonar) API。
 * 
 * 設定：
 * 你的 .env 檔案中原本應該是 API_KEY=... (Gemini Key)
 * 現在請把那個 API_KEY 的值換成你的 Perplexity Key (pplx-...)
 * 或者你可以新增一個 VITE_PERPLEXITY_API_KEY 並把下面這行改掉。
 */

// 優先讀取 VITE_PERPLEXITY_API_KEY，如果沒有就讀取原本的 API_KEY
const API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY || import.meta.env.API_KEY || '';

// Perplexity 推薦的模型，適合邏輯推理和規劃
const MODEL_NAME = 'sonar-reasoning-pro'; 

/**
 * 核心函式：呼叫 Perplexity API
 */
async function callPerplexityAPI(messages: any[], context: string) {
  
  console.log(`[${context}] Starting API Call...`);
  console.log(`[${context}] API_KEY present?`, !!API_KEY); // 印出 true 或 false
  console.log(`[${context}] API_KEY length:`, API_KEY ? API_KEY.length : 0);
  
  if (!API_KEY) {
    console.error("API Key is missing! Please check .env");
    throw new Error("Missing API Key.");
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: messages,
        // 溫度設為 0.2 讓輸出更穩定
        temperature: 0.2, 
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || "{}";
    
    return cleanJson(rawContent);
  } catch (error) {
    console.error(`AI Request Failed [${context}]:`, error);
    throw error;
  }
}

// JSON 清理小工具 (防止 AI 講廢話)
const cleanJson = (text: string) => {
  if (!text) return "{}";
  // 移除 Markdown 語法 (``````)
  let cleaned = text.replace(/``````/g, "").trim();
  
  // 嘗試只抓取真正的 JSON 部分 (從第一個 { 或 [ 開始，到最後一個 } 或 ] 結束)
  const firstOpen = cleaned.search(/[{[]/);
  const lastClose = cleaned.search(/[}]]$/); 
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  
  return cleaned;
};

/**
 * 1. 搜尋地點 (Search Places)
 * 對應原本的 findPlacesWithAI
 */
export const findPlacesWithAI = async (query: string, currentCenter?: { lat: number, lng: number }): Promise<any[]> => {
  const systemPrompt = `You are a travel assistant. Output strictly valid JSON only. No markdown, no conversational text.
  Response format: { "candidates": [{ "name": "string", "lat": number, "lng": number, "address": "string", "remarks": "string" }] }`;

  const userPrompt = `Find 3-5 real places for: "${query}".
  Context: Near Lat ${currentCenter?.lat || 'N/A'}, Lng ${currentCenter?.lng || 'N/A'}.
  Return JSON only.`;

  try {
    const jsonString = await callPerplexityAPI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      "findPlacesWithAI"
    );
    const json = JSON.parse(jsonString);
    return json.candidates || [];
  } catch (error) {
    return []; // 失敗時回傳空陣列，避免畫面 crash
  }
};

/**
 * 2. 生成行程 (Generate Itinerary)
 * 對應原本的 generateItineraryWithAI
 */
export const generateItineraryWithAI = async (prompt: string, daysCount: number): Promise<DayItinerary[]> => {
  const systemPrompt = `You are a professional travel planner. Output strictly valid JSON only.
  Response format: Array of objects. Example:
  [
    {
      "dayId": "day-1", "title": "Theme",
      "places": [{ "name": "string", "lat": number, "lng": number, "type": "activity", "time": "09:00", "remarks": "desc" }]
    }
  ]`;

  const userPrompt = `Plan a ${daysCount}-day trip. Request: "${prompt}".
  Requirements: Real coordinates, logical route, exactly ${daysCount} days.
  Return JSON Array only.`;

  try {
    const jsonString = await callPerplexityAPI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      "generateItineraryWithAI"
    );

    let rawData = JSON.parse(jsonString);
    if (!Array.isArray(rawData) && rawData.days) rawData = rawData.days; // 容錯處理

    // 補上 ID 防止前端報錯
    return rawData.map((day: any, index: number) => ({
      ...day,
      dayId: day.dayId || `day-${index + 1}`,
      places: (day.places || []).map((p: any) => ({
        ...p,
        id: crypto.randomUUID(),
        type: p.type || 'activity'
      }))
    }));
  } catch (error) {
    console.error("Planning Error:", error);
    throw error;
  }
};

/**
 * 3. 優化行程 (Optimize Itinerary)
 * 對應原本的 optimizeItineraryWithAI
 */
export const optimizeItineraryWithAI = async (
  currentItinerary: DayItinerary[],
  scope: 'day' | 'trip',
  activeDayId: string,
  constraints: string
): Promise<DayItinerary[]> => {
  
  const systemPrompt = `You are a logistics expert. Reorder the places to minimize travel time. Return strictly valid JSON only. Same structure as input.`;

  const userPrompt = `
    Scope: ${scope === 'day' ? `Optimize dayId: ${activeDayId}` : "Optimize whole trip"}
    Constraints: ${constraints || "Logistical flow"}
    Input JSON: ${JSON.stringify(currentItinerary)}
  `;

  try {
    const jsonString = await callPerplexityAPI(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        "optimizeItineraryWithAI"
    );

    let optimized = JSON.parse(jsonString);
    if (!Array.isArray(optimized) && optimized.days) optimized = optimized.days;

    return optimized.map((day: any) => ({
      ...day,
      places: (day.places || []).map((p: any) => ({
        ...p,
        id: crypto.randomUUID(),
        type: (p.type as PlaceType) || 'activity'
      }))
    }));
  } catch (error) {
    console.error("Optimization Error:", error);
    throw error;
  }
};

/**
 * 4. 解析文字 (Parse Text)
 * 對應原本的 parseItineraryFromText
 */
export const parseItineraryFromText = async (text: string): Promise<{ destination: string, startDate: string, endDate: string, days: DayItinerary[] }> => {
  const systemPrompt = `You are a parser. Extract travel data into strictly valid JSON.
  Format: { "destination": "string", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": [...] }`;

  const userPrompt = `Raw text: "${text}". Return JSON only.`;

  try {
    const jsonString = await callPerplexityAPI(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        "parseItineraryFromText"
    );

    const parsed = JSON.parse(jsonString);
    if (parsed.days) {
      parsed.days = parsed.days.map((day: any, idx: number) => ({
        ...day,
        dayId: day.dayId || `day-${idx + 1}`,
        places: (day.places || []).map((p: any) => ({
          ...p,
          id: crypto.randomUUID(),
          type: p.type || 'activity'
        }))
      }));
    }
    return parsed;
  } catch (error) {
    console.error("Parsing Error:", error);
    throw error;
  }
};
