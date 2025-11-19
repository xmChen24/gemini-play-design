import { GoogleGenAI } from "@google/genai";
import { Play } from "../types";

// Helper to safely get API Key from various environment locations
const getApiKey = () => {
  try {
    // In the browser via polyfill or standard env
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
    // Fallback for window polyfills specifically
    if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env.API_KEY) {
      return (window as any).process.env.API_KEY;
    }
  } catch (e) {
    console.warn('Error accessing API key:', e);
  }
  return '';
}

export const getCoachingInsights = async (play: Play): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("Gemini API Key not found.");
    return "AI Coach is unavailable (Missing API Key). Please ensure process.env.API_KEY is set.";
  }

  try {
    // Create instance per request to ensure latest config/key and avoid instantiation errors if key is missing initially
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      You are an expert flag football coach. Analyze this play:
      Name: ${play.name}
      Formation: ${play.formation}
      Tags: ${play.tags.join(', ')}
      Notes: ${play.notes}
      
      Players:
      ${play.players.map(p => `- ${p.label} (${p.role}) at position ${Math.round(p.x)},${Math.round(p.y)}`).join('\n')}
      
      Provide 3 brief, high-impact coaching points for this play. 
      Keep it concise (under 100 words total). 
      Focus on execution and key reads.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate insights.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while contacting the AI Coach.";
  }
};