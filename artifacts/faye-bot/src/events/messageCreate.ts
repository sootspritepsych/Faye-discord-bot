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
    `🌱 HANDLE_FAYE_MESSAGE | msg=${message.id} | user=${message.author.username}`
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

console.log(`CONTENT_RECEIVED: ${content}`);
  
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

// natural memory block goes HERE
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

console.log(`MEMORY_CHECK=${shouldSaveNaturalMemory} | content=${content}`);

if (shouldSaveNaturalMemory && content.length <= 200) {
  await saveUserMemory(
    message.author.id,
    message.author.username,
    content
  );

  console.log(
    `🧠 Natural memory saved for ${message.author.username}: ${content}`
  );
}
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

console.log(
  `🤖 CALLING_OPENAI | msg=${message.id}`
);

const userMemories = await getUserMemories(
  message.author.id
);

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
    await message.reply("The garden winds are restless right now... try again in a moment. 🍃");
  }
}

export default function registerMessageCreateEvent(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;

    const [sticky] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, message.channelId));

    if (sticky && message.id !== sticky.lastMessageId) {
      setTimeout(() => updateStickyMessage(client, message.channelId), 1000);
    }
    
console.log(
  `PREFIX_MATCH=${message.content.toLowerCase().startsWith(PREFIX)}`
);

console.log(
  `MENTION_MATCH=${client.user && message.mentions.has(client.user)}`
);
    
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
  });
}
