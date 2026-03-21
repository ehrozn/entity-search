import { GoogleGenAI } from "@google/genai";

export interface BusinessInfo {
  name: string;
  state: string;
}

// Store active chat sessions
const chatSessions = new Map<string, any>();

export async function searchBusinessInfo(info: BusinessInfo, sessionId: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    return "An error occurred: Gemini API key is missing. Please set GEMINI_API_KEY in your environment (Settings -> Secrets).";
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a Senior Tax Research Auditor for US Tax Firms. Your mission is to provide 100% accurate data for tax compliance and BOI reporting.

  CRITICAL SEARCH INSTRUCTIONS:
  1. **Primary Focus:** Search for "${info.name}" in ${info.state}.
  2. **Multi-State Search:** Also search for "${info.name}" in ALL other US states to identify potential nexus or duplicate entities.
  3. **Categorization:** 
     - **Exact Match (Selected State):** The entity in ${info.state} with the exact name.
     - **Exact Match (Other States):** Entities in other states with the exact same name.
     - **Similar Names:** Entities with names very similar to "${info.name}" (e.g., DBA names, common misspellings).

  DATA SEPARATION:
  - **Owners:** Individuals or entities with legal ownership (Members, Shareholders).
  - **Directors/Officers:** Individuals in management roles (President, Secretary, Treasurer, Director) who may not be owners.

  The report MUST follow this structure:
  
  # 🏛️ Tax Audit Report: ${info.name}
  
  ## 📑 Primary Entity (${info.state})
  | Property | Information |
  | :--- | :--- |
  | **Legal Name** | [Full Legal Name from SOS] |
  | **Entity Type** | [LLC, S-Corp, C-Corp, etc.] |
  | **Status** | [Active/Dissolved] |
  
  ## 👥 Ownership (Legal Members)
  [List legal owners found in SOS records for ${info.state}]
  
  ## 👔 Management (Directors & Officers)
  [List directors, officers, and managers found in SOS records for ${info.state}]
  
  ## 🌎 Multi-State Presence & Exact Matches
  *   **Exact Matches in Other States:** [List states where the exact same name exists]
  *   **Similar Entities Found:** [List similar names found across the US]
  
  ## 📍 Nexus & Activity Analysis
  *   **Registered State:** ${info.state}
  *   **High Activity States:** [States where they have physical presence or high review volume]
  *   **Nexus Risk:** [Risk level and reason]

  ---
  ### DATA_FOR_UI_DO_NOT_EDIT
  {
    "financials": [{"year": "2023", "revenue": 0}],
    "naics": [{"code": "XXXXXX", "description": "Industry", "confidence": "High"}],
    "nexus_risks": [{"state": "State", "risk_level": "High", "reason": "Reason"}],
    "owners": [{"name": "Name", "role": "Owner/Member", "source": "SOS"}],
    "directors": [{"name": "Name", "role": "Director/President", "source": "SOS"}],
    "other_states_exact": [{"state": "State", "status": "Active", "source": "SOS"}],
    "similar_entities": [{"name": "Similar Name", "state": "State", "status": "Active"}]
  }
  ---
  *Note: Ensure the JSON is RAW and NOT wrapped in markdown. Keep owners and directors strictly separate.*`;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    chatSessions.set(sessionId, chat);
    
    const response = await chat.sendMessage({ message: prompt });
    return response.text || "Information not found.";
  } catch (error: any) {
    console.error("Gemini API Error Details:", error);
    // Log more specific error info if available
    if (error.message) console.error("Error Message:", error.message);
    if (error.status) console.error("Error Status:", error.status);
    
    return `An error occurred while searching for information: ${error.message || 'Unknown error'}. Please check your API settings or try again later.`;
  }
}

export async function askFollowUp(sessionId: string, question: string) {
  const chat = chatSessions.get(sessionId);
  if (!chat) {
    return "Session not found. Please start a new search.";
  }

  try {
    const response = await chat.sendMessage({ message: question });
    return response.text || "No response found.";
  } catch (error: any) {
    console.error("Gemini Follow-up Error:", error);
    return `An error occurred while processing your question: ${error.message || 'Unknown error'}.`;
  }
}
