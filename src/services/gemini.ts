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
  
  const prompt = `You are a specialized Tax Research Assistant for US Tax Managers. Your goal is to find missing business information for tax returns (Forms 1120, 1065, 1040 Sch C) and identify potential tax risks.

  Search for "${info.name}" in ${info.state} across:
  1. **Business Directories:** Yelp, Thumbtack, LinkedIn, Glassdoor.
  2. **Official Sources:** Secretary of State registries, SEC EDGAR, IRS public records.

  The report MUST follow this structure:
  
  # 🏛️ Tax Research Report: ${info.name}
  
  ## 📑 Tax & Legal Identity
  | Property | Information |
  | :--- | :--- |
  | **Legal Name** | [Full Legal Name] |
  | **Entity Type** | [LLC, S-Corp, C-Corp, Partnership, etc.] |
  | **EIN Status** | [Found/Not Found] |
  | **Formation Date** | [Date] |
  | **Status** | [Active/Good Standing] |
  
  ## 📍 Location & Nexus Analysis
  *   **Primary Address:** [Full Address for tax filing]
  *   **Activity in Other States:** [List other states where company has reviews/offices/activity on Yelp/Thumbtack]
  *   **Nexus Risk:** [Briefly state if there's a risk of Sales Tax Nexus in other states based on activity]
  
  ## 💰 Financial & Operational Data
  *   **Estimated Annual Revenue:** [Amount]
  *   **Employee Count:** [Estimate]
  
  ## 🔗 Source Links
  *   **Yelp/Thumbtack:** [URLs]
  *   **Official Registry:** [URL]

  ## 📝 Summary for Tax Return
  [Provide a concise summary of business activity.]

  ---
  ### DATA_FOR_UI_DO_NOT_EDIT
  {
    "financials": [
      {"year": "2021", "revenue": 0},
      {"year": "2022", "revenue": 0},
      {"year": "2023", "revenue": 0}
    ],
    "naics": [
      {"code": "XXXXXX", "description": "Primary Industry Name", "confidence": "High"},
      {"code": "XXXXXX", "description": "Secondary Industry Name", "confidence": "Medium"}
    ],
    "nexus_risks": [
      {"state": "State Name", "risk_level": "High/Medium", "reason": "Active reviews/services found here but registered in ${info.state}"}
    ]
  }
  ---
  *Note: Ensure the JSON is valid and filled with real data if found.*`;

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
