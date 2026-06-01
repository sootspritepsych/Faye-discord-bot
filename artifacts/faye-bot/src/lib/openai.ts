import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const AI_AVAILABLE = !!(baseURL && apiKey);

if (!AI_AVAILABLE) {
  console.warn("⚠️  AI env vars not set — Faye will use fallback responses only.");
}

export const openai = AI_AVAILABLE ? new OpenAI({ baseURL, apiKey }) : null;

// Fallback responses Faye gives when AI is unavailable or fails
const FALLBACK_RESPONSES = [
  "The garden is a little quiet right now... but I'm still here with you. 🌿",
  "Even when the lantern flickers, the path remains. Give me a moment, traveler. 🏮",
  "Sprout seems to have tangled up my thoughts — could you ask again in a moment? 🌱",
  "The winds are restless today. Revisit me soon and I'll have a proper answer for you. 🍃",
  "My voice grows faint for a moment, friend. The garden will bloom again shortly. 🌸",
  "Something has stirred the forest — I'll need a breath before I can reply. 🌙",
];

function getFallback(): string {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

export async function getFayeResponse(userMessage: string, username: string): Promise<string> {
  if (!openai) {
    console.warn("getFayeResponse called but AI client not initialized");
    return getFallback();
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 400,
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
    });

    const text = completion.choices[0]?.message?.content;

    // Log so we can debug in the Replit console if something is wrong
    if (!text || !text.trim()) {
      console.error(
        "⚠️  AI returned empty content. Full response:",
        JSON.stringify({
          id: completion.id,
          model: completion.model,
          finish_reason: completion.choices[0]?.finish_reason,
          usage: completion.usage,
          content: text,
        })
      );
      return getFallback();
    }

    return text.trim();
  } catch (err: unknown) {
    // Log the real error so it appears in the Replit workflow console
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status;
    console.error(`❌ OpenAI API error [status=${status ?? "?"}]: ${message}`, err);
    return getFallback();
  }
}
