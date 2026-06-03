import { Client, Events, Message } from "discord.js";
import { getFayeResponse } from "../lib/openai";
import { updateStickyMessage } from "../lib/stickyManager";
import { db, stickyMessages } from "../lib/database";
import { eq } from "drizzle-orm";
import { getRecentConversation, saveConversationMessage } from "../lib/memory";
import { saveMemory } from "../lib/memory";

const PREFIX = "!f";
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5000;

async function handleFayeMessage(message: Message, content: string) {
  const userId = message.author.id;
  const now = Date.now();
  const lastUsed = cooldowns.get(userId) ?? 0;

  if (now - lastUsed < COOLDOWN_MS) {
    await message.react("🍃");
    return;
  }

  cooldowns.set(userId, now);

  if (!content) {
    await message.reply("You called for me? 🌿 Ask me anything — I'm here to help.");
    return;
  }

  if ("sendTyping" in message.channel) await message.channel.sendTyping();

  try {
await saveConversationMessage(
  message.channel.id,
  message.author.id,
  message.author.username,
  "user",
  content
);

const recentMessages = await getRecentConversation(message.channel.id);

await saveMemory(
  message.channelId,
  message.author.id,
  message.author.username,
  "user",
  content
);
    
const response = await getFayeResponse(
  content,
  message.author.username,
  recentMessages
);

await message.reply(response);

await saveMemory(
  message.channelId,
  client.user?.id || "faye",
  "Faye",
  "assistant",
  text
);
    
await saveConversationMessage(
  message.channel.id,
  client.user?.id ?? "faye",
  "Faye",
  "assistant",
  response
);
  } catch (err) {
    console.error("Error getting Faye response:", err);
    await message.reply("The garden winds are restless right now... try again in a moment. 🍃");
  }
}

export default function registerMessageCreateEvent(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;

    // Handle sticky messages — repost after each new message
    const [sticky] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, message.channelId));

    if (sticky && message.id !== sticky.lastMessageId) {
      setTimeout(() => updateStickyMessage(client, message.channelId), 1000);
    }

    // !f prefix — e.g. "!f how are you?" or just "!f"
    if (message.content.toLowerCase().startsWith(PREFIX)) {
      const content = message.content.slice(PREFIX.length).trim();
      await handleFayeMessage(message, content);
      return;
    }

    // @mention — e.g. "@Faye how are you?"
    if (client.user && message.mentions.has(client.user)) {
      const content = message.content
        .replace(`<@${client.user.id}>`, "")
        .replace(`<@!${client.user.id}>`, "")
        .trim();
      await handleFayeMessage(message, content);
    }
  });
}
