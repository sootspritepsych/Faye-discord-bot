import { Client, Events, Message } from "discord.js";
import { eq } from "drizzle-orm";
import { getFayeResponse } from "../lib/openai";
import { handleScamImage } from "../lib/imageGuard";
import { updateStickyMessage } from "../lib/stickyManager";
import { db, stickyMessages } from "../lib/database";
import { getRecentConversation, saveConversationMessage } from "../lib/memory";
import { getUserMemories, saveUserMemory } from "../lib/userMemory";

const PREFIX = "!f";
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5000;

let messageCreateRegistered = false;

async function handleFayeMessage(
  client: Client,
  message: Message,
  content: string
) {
  const userId = message.author.id;
  const now = Date.now();
  const lastUsed = cooldowns.get(userId) ?? 0;

  if (now - lastUsed < COOLDOWN_MS) {
    await message.react("🍃");
    return;
  }

  cooldowns.set(userId, now);

  if (!content) {
    await message.reply(
      "You called for me? 🌿 Ask me anything — I'm here to help."
    );
    return;
  }

  const lowerContent = content.toLowerCase();

  if (lowerContent.startsWith("remember that ")) {
    const memory = content.slice("remember that ".length).trim();
    await saveUserMemory(message.author.id, message.author.username, memory);
    await message.reply("I'll tuck that memory safely into the garden. 🌿");
    return;
  }

  const naturalMemoryPatterns = [
    "my favorite ",
    "my favourite ",
    "i like ",
    "i love ",
    "my dog is ",
    "my cat is ",
    "my pet is ",
    "my name is ",
    "i am ",
    "i'm ",
  ];

  if (
    naturalMemoryPatterns.some((pattern) => lowerContent.includes(pattern)) &&
    content.length <= 200
  ) {
    await saveUserMemory(message.author.id, message.author.username, content);
  }

  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping();
  }

  try {
    await saveConversationMessage(
      message.channel.id,
      message.author.id,
      message.author.username,
      "user",
      content
    );

    const recentMessages = await getRecentConversation(message.channel.id);
    const userMemories = await getUserMemories(message.author.id);

    const response = await getFayeResponse(
      content,
      message.author.username,
      recentMessages,
      userMemories
    );

    await message.reply(response);

    await saveConversationMessage(
      message.channel.id,
      client.user?.id ?? "faye",
      "Faye",
      "assistant",
      response
    );
  } catch (err) {
    console.error("Error getting Faye response:", err);
    await message.react("🍃");
  }
}

export default function registerMessageCreateEvent(client: Client) {
  if (messageCreateRegistered) {
    console.log("messageCreate already registered, skipping");
    return;
  }

  messageCreateRegistered = true;

  console.log("REGISTERING messageCreate event");

  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      const [sticky] = await db
        .select()
        .from(stickyMessages)
        .where(eq(stickyMessages.channelId, message.channelId));

      if (message.author.bot && message.author.id !== client.user?.id) return;

      if (message.attachments.size > 0) {
        const wasScam = await handleScamImage(message);
        if (wasScam) return;
      }

      if (message.author.id === client.user?.id) {
        if (sticky?.lastMessageId === message.id) return;
      }

      if (sticky && message.id !== sticky.lastMessageId) {
        setTimeout(() => {
          updateStickyMessage(client, message.channelId).catch(console.error);
        }, 1000);
      }

      if (message.content.toLowerCase().startsWith(PREFIX)) {
        const content = message.content.slice(PREFIX.length).trim();
        await handleFayeMessage(client, message, content);
        return;
      }

      if (client.user && message.mentions.has(client.user)) {
        const content = message.content
          .replace(`<@${client.user.id}>`, "")
          .replace(`<@!${client.user.id}>`, "")
          .trim();

        await handleFayeMessage(client, message, content);
      }
    } catch (err) {
      console.error("ERROR INSIDE messageCreate:", err);
    }
  });
}
