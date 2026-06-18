import { Client, Events, Message } from "discord.js";
import { getFayeResponse } from "../lib/openai";
import { updateStickyMessage } from "../lib/stickyManager";
import { db, stickyMessages } from "../lib/database";
import { eq } from "drizzle-orm";
import { getRecentConversation, saveConversationMessage } from "../lib/memory";
import { getUserMemories, saveUserMemory } from "../lib/userMemory";

const PREFIX = "!f";
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5000;

async function handleFayeMessage(
  client: Client,
  message: Message,
  content: string
) {
  console.log(
    `HANDLE_FAYE_MESSAGE | msg=${message.id} | user=${message.author.username}`
  );

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

    await saveUserMemory(
      message.author.id,
      message.author.username,
      memory
    );

    await message.reply(
      "I'll tuck that memory safely into the garden, dear traveler. 🌿"
    );

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

  const shouldSaveNaturalMemory = naturalMemoryPatterns.some((pattern) =>
    lowerContent.includes(pattern)
  );

  if (shouldSaveNaturalMemory && content.length <= 200) {
    await saveUserMemory(
      message.author.id,
      message.author.username,
      content
    );
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
  console.log("REGISTERING messageCreate event");

  client.on(Events.MessageCreate, async (message: Message) => {
  try {
    console.log("MESSAGE CREATE FIRED:", {
      messageId: message.id,
      channelId: message.channelId,
      author: message.author.username,
      isBot: message.author.bot,
      content: message.content,
    });

    // Ignore other bots
if (message.author.bot && message.author.id !== client.user?.id) return;

// Ignore Faye's own sticky messages so they don't cause a loop
if (message.author.id === client.user?.id) {
  const [sticky] = await db
    .select()
    .from(stickyMessages)
    .where(eq(stickyMessages.channelId, message.channelId));

  if (sticky && message.id === sticky.lastMessageId) {
    return;
  }
}

    console.log("CHECKING STICKY TABLE FOR:", message.channelId);

      const [sticky] = await db
        .select()
        .from(stickyMessages)
        .where(eq(stickyMessages.channelId, message.channelId));

      console.log("STICKY RESULT:", sticky);

      if (sticky && message.id !== sticky.lastMessageId) {
        console.log("TRIGGERING STICKY UPDATE FOR:", message.channelId);

        setTimeout(() => {
          updateStickyMessage(client, message.channelId);
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