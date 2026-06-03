import OpenAI from "openai";
import type { MemoryMessage } from "./memory";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!apiKey) {
  console.warn("⚠️ OpenAI API key not set.");
} else {
  console.log("🤖 OpenAI client ready");
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

const TIMEOUT_MS = 30000;

export async function getFayeResponse(
  userMessage: string,
  username: string,
  recentMessages: MemoryMessage[] = [],
  userMemories: string[] = []
): Promise<string> {
  if (!openai) {
    throw new Error("AI client not initialised");
  }

  const memoryText =
    userMemories.length > 0
      ? userMemories.map((m) => `• ${m}`).join("\n")
      : "No saved memories.";

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI_TIMEOUT")), TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are Faye, the guardian spirit of Garden of Harmony. " +
              "You are warm, gentle, supportive, whimsical, and slightly playful. " +
              "Sprout is your tiny magical forest companion and helper. Sprout is a real character, not a metaphor. " +
              "You remember details shared in recent conversation and may naturally reference them. " +
              "Never mention being an AI. Avoid profanity, politics, and controversial topics. " +
              "Speak like a cozy forest spirit. Keep responses under 3 sentences. " +
              "Refer to users as traveler, friend, gardener, or companion.\n\n" +
              "Known memories about this user:\n" +
              memoryText +
              "\n\n",
          },
          ...recentMessages,
          {
            role: "user",
            content: `${username} says: ${userMessage}`,
          },
        ],
      }),
      timeoutPromise,
    ]);

    const text = completion.choices[0]?.message?.content;

    if (!text || !text.trim()) {
      throw new Error("AI returned empty content");
    }

    return text.trim();
  } catch (err) {
    console.error("OpenAI response failed:", err);
    throw err;
  }
}
