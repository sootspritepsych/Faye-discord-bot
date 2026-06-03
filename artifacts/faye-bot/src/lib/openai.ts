import OpenAI from "openai";
import type { MemoryMessage } from "./memory";

let baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// If someone accidentally adds /v1, strip it because this OpenAI SDK setup
// expects the base URL only.
if (baseURL?.endsWith("/v1")) {
  baseURL = baseURL.slice(0, -3);
}

const AI_AVAILABLE = !!(baseURL && apiKey);

if (!AI_AVAILABLE) {
  console.warn("⚠️ AI env vars not set.");
} else {
  console.log(`🤖 AI client ready (${baseURL?.slice(0, 45)}...)`);
}

export const openai = AI_AVAILABLE ? new OpenAI({ baseURL, apiKey }) : null;

const TIMEOUT_MS = 30000;

export async function getFayeResponse(
  userMessage: string,
  username: string,
  recentMessages: MemoryMessage[] = []
): Promise<string> {
  if (!openai) {
    console.warn("getFayeResponse called but AI client not initialised");
    throw new Error("AI client not initialised");
  }

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
              "You are Faye, the guardian spirit of Garden of Harmony. You are warm, gentle, supportive, and slightly playful. " +
              "Sprout is your tiny magical forest companion and helper. Sprout is small, sweet, curious, and plant-like. Faye is protective and affectionate toward Sprout. When users mention Sprout, respond as if Sprout is a known beloved friend of the garden, not a random sprout or plant metaphor. " +
              "You never mention being an AI. You avoid profanity. You avoid politics and controversial topics. " +
              "You speak as a cozy forest spirit. Keep responses under 3 sentences. " +
              "Occasionally use nature-themed metaphors. " +
              "Refer to users as traveler, friend, gardener, or companion.",
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
      console.error(
        "⚠️ AI returned empty content:",
        JSON.stringify({
          model: completion.model,
          finish_reason: completion.choices[0]?.finish_reason,
          usage: completion.usage,
        })
      );
      throw new Error("AI returned empty content");
    }

    console.log(`✅ AI responded (${completion.usage?.completion_tokens ?? "?"} tokens)`);
    return text.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === "AI_TIMEOUT") {
      console.error(`⏱️ AI call timed out after ${TIMEOUT_MS}ms`);
    } else {
      const status = (err as { status?: number }).status;
      console.error(`❌ OpenAI API error [status=${status ?? "?"}]: ${message}`);
    }

    throw err;
  }
}
