import OpenAI from "openai";

let baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// Replit's AI proxy exposes /chat/completions directly.
// The OpenAI SDK appends /chat/completions to the baseURL, so we must
// strip any trailing /v1 that the env var might include to avoid doubling it.
if (baseURL?.endsWith("/v1")) {
  baseURL = baseURL.slice(0, -3);
}

const AI_AVAILABLE = !!(baseURL && apiKey);

if (!AI_AVAILABLE) {
  console.warn("⚠️  AI env vars not set — Faye will use fallback responses only.");
} else {
  console.log(`🤖 AI client ready (${baseURL?.slice(0, 45)}...)`);
}

export const openai = AI_AVAILABLE ? new OpenAI({ baseURL, apiKey }) : null;

const FALLBACK_RESPONSES = [
  "The garden is a little quiet right now... but I'm still here with you. 🌿",
  "Even when the lantern flickers, the path remains. Give me a moment, traveler. 🏮",
  "Sprout seems to have tangled up my thoughts — could you ask again in a moment? 🌱",
  "The winds are restless today. Revisit me soon and I'll have a proper answer. 🍃",
  "My voice grows faint for a moment, friend. The garden will bloom again shortly. 🌸",
  "Something has stirred the forest — I'll need a breath before I can reply. 🌙",
];

function getFallback(): string {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

const TIMEOUT_MS = 15000;

export async function getFayeResponse(userMessage: string, username: string): Promise<string> {
  if (!openai) {
    console.warn("getFayeResponse called but AI client not initialised");
    return getFallback();
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI_TIMEOUT")), TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        // gpt-4o-mini is a reasoning model — it consumes token for internal
        // thinking before writing output. Use a generous budget so it doesn't
        // exhaust the limit on reasoning alone and return empty content.
        max_completion_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are Faye, the guardian spirit of Garden of Harmony. You are warm, gentle, supportive, and slightly playful. " +
              "You never mention being an AI. You avoid profanity. You avoid politics and controversial topics. " +
              "You speak as a cozy forest spirit. Keep responses under 4 sentences. " +
              "Occasionally use nature-themed metaphors. " +
              "Refer to users as traveler, friend, gardener, or companion.",
          },
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
      console.error("⚠️  AI returned empty content:", JSON.stringify({
        model: completion.model,
        finish_reason: completion.choices[0]?.finish_reason,
        usage: completion.usage,
      }));
      throw new Error("AI returned empty content");
    }

    console.log(`✅ AI responded (${completion.usage?.completion_tokens ?? "?"} tokens)`);
    return text.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "AI_TIMEOUT") {
      console.error(`⏱️  AI call timed out after ${TIMEOUT_MS}ms — using fallback`);
    } else {
      const status = (err as { status?: number }).status;
      console.error(`❌ OpenAI API error [status=${status ?? "?"}]: ${message}`);
    }
    throw err;
  }
}
