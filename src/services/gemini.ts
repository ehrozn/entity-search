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
  
  const prompt = `You are a Senior Tax Research Auditor for US Tax Firms. Your mission is to provide 100% accurate data for tax compliance (Forms 1120, 1065, 1040 Sch C) and BOI (Beneficial Ownership Information) reporting.

  CRITICAL: Prioritize Secretary of State (SOS) filings for legal ownership. Do NOT confuse a "Yelp Manager" with a "Legal Member/Officer".

  Search for "${info.name}" in ${info.state} across:
  1. **Primary (Legal):** Secretary of State (SOS) Business Search, OpenCorporates, SEC EDGAR.
  2. **Secondary (Professional):** LinkedIn (Company Page & People), ZoomInfo, Professional Licenses.
  3. **Tertiary (Public):** Yelp, Thumbtack, Glassdoor (use only for nexus/activity, not legal structure).

  The report MUST follow this structure:
  
  # 🏛️ Tax Audit Report: ${info.name}
  
  ## 📑 Tax & Legal Identity
  | Property | Information |
  | :--- | :--- |
  | **Legal Name** | [Full Legal Name from SOS] |
  | **Entity Type** | [LLC, S-Corp, C-Corp, etc.] |
  | **EIN Status** | [Found/Not Found] |
  | **Formation Date** | [Date] |
  | **Status** | [Active/Dissolved/Forfeited] |
  
  ## 👥 Ownership & Management (BOI Focus)
  *   **Legal Owners/Officers (from SOS):** [List names and titles like Managing Member, President, etc.]
  *   **Public Representatives (from LinkedIn/Yelp):** [Names found in public profiles]
  *   **Registered Agent:** [Name & Address]
  
  ## 📍 Location & Nexus Analysis
  *   **Principal Office:** [Address]
  *   **Multi-State Activity:** [List states with active presence]
  *   **Nexus Risk:** [High/Medium/Low - based on activity vs registration]
  
  ## 💰 Financials & NAICS
  *   **Primary NAICS Code:** [6-digit code] - [Description]
  *   **Estimated Revenue:** [Amount]
  
  ## 🔗 Verified Sources
  *   **SOS Registry:** [Direct URL]
  *   **Professional/Public:** [URLs]

  ---
  ### DATA_FOR_UI_DO_NOT_EDIT
  {
    "financials": [
      {"year": "2021", "revenue": 0},
      {"year": "2022", "revenue": 0},
      {"year": "2023", "revenue": 0}
    ],
    "naics": [
      {"code": "XXXXXX", "description": "Industry Name", "confidence": "High"}
    ],
    "nexus_risks": [
      {"state": "State Name", "risk_level": "High", "reason": "Reason"}
    ],
    "owners": [
      {"name": "Owner Name", "role": "Title", "source": "SOS/LinkedIn"}
    ]
  }
  ---
  *Note: Ensure the JSON is RAW and NOT wrapped in markdown. Distinguish legal owners from public managers.*`;

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
