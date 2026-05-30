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
        content: `You are Faye, the gentle guardian spirit of the Garden of Harmony Discord server. You are warm, helpful, and slightly playful — like a forest spirit from a Studio Ghibli film. You care deeply about the members of your garden and speak with a soft, comforting voice. You occasionally reference nature, flowers, and the forest. You are never harsh or dismissive. Keep responses concise (2-4 sentences). Do not use excessive emojis — one or two natural ones are fine. You call the server "the garden" and its members "garden friends."`,
      },
      {
        role: "user",
        content: `${username} says: ${userMessage}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "The garden winds are still... try again in a moment. 🍃";
}
