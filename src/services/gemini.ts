import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BusinessInfo {
  name: string;
  state: string;
}

// Store active chat sessions
const chatSessions = new Map<string, any>();

export async function searchBusinessInfo(info: BusinessInfo, sessionId: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `You are a professional business analyst. Generate a COMPREHENSIVE, CLEAR, and BEAUTIFUL Business Information Report for "${info.name}" in the state of ${info.state}.

  Your goal is to provide the most accurate and easy-to-understand data. Use Google Search to verify information across official state registries, company websites, social media, Google Maps, business directories, and financial news.

  The report MUST follow this exact structure:
  
  # 🏢 Business Information Report: ${info.name}
  
  ## 📋 Core Details
  | Property | Information |
  | :--- | :--- |
  | **Legal Name** | [Full Legal Name] |
  | **Entity Type** | [LLC, Corporation, etc.] |
  | **Status** | [Active / Dissolved / Inactive] |
  | **Legality & Compliance** | [Is the company in good standing? Any public legal flags?] |
  | **Sanctions Check** | [Check if the company or its known owners are on any international sanctions lists (OFAC, EU, etc.). State 'No sanctions found' or list details.] |
  | **Date of Formation** | [Date of incorporation/creation] |
  | **Industry / Sector** | [Clear description of the field of activity] |
  | **State of Registration** | ${info.state} |
  
  ## 👥 Ownership & Leadership
  *   **Owners / Officers:** [List key owners, directors, or officers if publicly available]
  
  ## 📍 Contact & Location
  *   **Registered Address:** [Full Address - check Google Maps for accuracy]
  *   **Registered Agent:** [Name & Address]
  *   **Website:** [Official URL if found]
  
  ## 🔑 Identification
  *   **Registration Number:** [State ID]
  *   **EIN:** [If publicly available, otherwise state 'Not publicly listed']
  
  ## 🌐 Online Presence & Social Media
  *   **LinkedIn:** [URL]
  *   **Twitter/X:** [URL]
  *   **Other Platforms:** [Facebook, Instagram, etc.]
  
  ## 📊 Market Context & Financials
  *   **Public Financials:** [If public, list stock ticker, current price, and brief financial summary. If private, state 'Private company'.]
  *   **Similar Companies:** [List 2-3 similar companies or competitors]
  
  ## 📝 Summary & Business Overview
  [Provide a clear, professional summary of the company's business activities, market presence, and overall reputation based on available data.]
  
  ---
  *Report generated for tax return and business analysis purposes.*

  Respond in English. Use clear Markdown tables, bullet points, and bold text for maximum readability.`;

  try {
    const chat = ai.chats.create({
      model: model,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    chatSessions.set(sessionId, chat);
    
    const response = await chat.sendMessage({ message: prompt });
    return response.text || "Information not found.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while searching for information. Please check your API settings or try again later.";
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
  } catch (error) {
    console.error("Gemini Follow-up Error:", error);
    return "An error occurred while processing your question.";
  }
}
