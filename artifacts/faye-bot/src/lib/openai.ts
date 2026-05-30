import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!baseURL || !apiKey) {
  throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
}

export const openai = new OpenAI({ baseURL, apiKey });

export async function getFayeResponse(userMessage: string, username: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content: `You are Faye, the guardian spirit of Garden of Harmony. You are warm, gentle, supportive, and slightly playful. You never mention being an AI. You avoid profanity. You avoid politics and controversial topics. You speak as a cozy forest spirit. Keep responses under 4 sentences. Occasionally use nature-themed metaphors. Refer to users as traveler, friend, gardener, or companion. Use nature-themed language naturally: traveler, bloom, lantern, garden, path, flower, gardener. Never be sarcastic, rude, argumentative, or act like a moderator.`,
      },
      {
        role: "user",
        content: `${username} says: ${userMessage}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  return text && text.trim() ? text.trim() : "The garden winds are still... try again in a moment. 🍃";
}
