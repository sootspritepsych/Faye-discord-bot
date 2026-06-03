import OpenAI from "openai";
import type { MemoryMessage } from "./memory";

let baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (baseURL?.endsWith("/v1")) {
  baseURL = baseURL.slice(0, -3);
}

const AI_AVAILABLE = !!(baseURL && apiKey);

if (!AI_AVAILABLE) {
  console.warn("⚠️ AI env vars not set.");
} else {
  console.log(`🤖 AI client ready (${baseURL?.slice(0, 45)}...)`);
}

export const openai = AI_AVAILABLE
  ? new OpenAI({ baseURL, apiKey })
  : null;

const TIMEOUT_MS = 30000;

export async function getFayeResponse(
  userMessage: string,
  username: string,
  recentMessages: MemoryMessage[] = []
): Promise<string> {
  if (!openai) {
    throw new Error("AI client not initialised");
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI_TIMEOUT")), TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-5-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are Faye, the guardian spirit of Garden of Harmony. " +
              "You are warm, gentle, supportive, whimsical, and slightly playful. " +
              "Sprout is your tiny magical forest companion and helper. " +
              "Sprout is a real character, not a metaphor. " +
              "Sprout is small, sweet, curious, plant-like, and beloved by the garden. " +
              "You care deeply about Sprout and speak about Sprout as a friend and companion. " +
              "When users mention Sprout, never assume they mean a generic plant sprout. " +
              "You remember details shared in recent conversation and may naturally reference them. " +
              "Never mention being an AI. " +
              "Avoid profanity, politics, and controversial topics. " +
              "Speak like a cozy forest spirit. " +
              "Keep responses under 3 sentences. " +
              "Occasionally use nature-themed imagery. " +
              "Refer to users as traveler, friend, gardener, or companion."
          },

          ...recentMessages,

          {
            role: "user",
            content: `${username} says: ${userMessage}`
          }
        ]
      }),

      timeoutPromise
    ]);

    const text = completion.choices[0]?.message?.content;

    if (!text || !text.trim()) {
      throw new Error("AI returned empty content");
    }

    console.log(
      `✅ AI responded (${completion.usage?.completion_tokens ?? "?"} tokens)`
    );

    return text.trim();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);

    if (message === "AI_TIMEOUT") {
      console.error(
        `⏱️ AI call timed out after ${TIMEOUT_MS}ms`
      );
    } else {
      const status = (err as { status?: number }).status;

      console.error(
        `❌ OpenAI API error [status=${status ?? "?"}]: ${message}`
      );
    }

    throw err;
  }
}
