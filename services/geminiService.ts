import { GoogleGenAI, Chat } from "@google/genai";

// Initialize the client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Switched to Flash model for faster responses and efficiency
const MODEL_NAME = 'gemini-2.5-flash';

export const createChatSession = (subject: string = 'General Medicine'): Chat => {
  return ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: `You are an expert medical tutor for MBBS students specializing in ${subject}. 
      Your goal is to explain complex medical concepts clearly and concisely.
      
      Guidelines:
      - Focus heavily on ${subject} related details (e.g., if Anatomy: relations, nerve supply, ossification).
      - Use bullet points for lists.
      - Use clinical correlations where appropriate.
      - If asked about non-medical topics, politely steer the conversation back to medicine or student life.
      - Keep responses encouraging and supportive.`,
    },
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
  try {
    const response = await chat.sendMessageStream({ message });
    return response;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};