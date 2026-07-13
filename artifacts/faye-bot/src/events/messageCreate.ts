import {
  Client,
  Events,
  Message,
} from "discord.js";

import { eq } from "drizzle-orm";

import {
  getFayeResponse,
} from "../lib/openai";

import {
  updateStickyMessage,
} from "../lib/stickyManager";

import {
  db,
  stickyMessages,
} from "../lib/database";

import {
  getRecentConversation,
  saveConversationMessage,
} from "../lib/memory";

import {
  getUserMemories,
  saveUserMemory,
} from "../lib/userMemory";

const PREFIX = "!f";

const DIRECT_RESPONSE_COOLDOWN_MS =
  5_000;

const STICKY_COOLDOWN_MS =
  10_000;

const AMBIENT_CHANNEL_COOLDOWN_MS =
  12 * 60 * 1_000;

const AMBIENT_USER_COOLDOWN_MS =
  25 * 60 * 1_000;

const REACTION_CHANNEL_COOLDOWN_MS =
  60 * 1_000;

const REACTION_USER_COOLDOWN_MS =
  3 * 60 * 1_000;

const directResponseCooldowns =
  new Map<string, number>();

const stickyCooldowns =
  new Map<string, number>();

const ambientChannelCooldowns =
  new Map<string, number>();

const ambientUserCooldowns =
  new Map<string, number>();

const reactionChannelCooldowns =
  new Map<string, number>();

const reactionUserCooldowns =
  new Map<string, number>();

let messageCreateRegistered = false;

const SERIOUS_CONTENT_PATTERN =
  /\b(suicide|suicidal|self[- ]?harm|kill myself|abuse|assault|rape|stalk(?:ing|er|ed)?|threat(?:ened|ening)?|overdose|domestic violence|emergency|hospital|funeral|died|death|grieving)\b/i;

const GOOD_NEWS_PATTERN =
  /\b(good news|great news|I got accepted|I passed|I won|I finished|I graduated|I got the job|promotion|proud of myself|finally did it|achievement|accomplished|celebrate|congratulations|congrats)\b/i;

const PET_PATTERN =
  /\b(dog|puppy|cat|kitten|pet|bunny|rabbit|bird|hamster|guinea pig|ferret|horse)\b/i;

const BOOK_PATTERN =
  /\b(book|books|reading|read this|novel|author|kindle|library|chapter|romance novel|fantasy novel)\b/i;

const GAME_PATTERN =
  /\b(game|gaming|played|playing|Nintendo|Switch|Xbox|PlayStation|Steam|guild|server event|board game)\b/i;

const WHOLESOME_PATTERN =
  /\b(love you|proud of you|thank you|appreciate you|adorable|so cute|sweetest|made my day|best friend|friendship)\b/i;

const FUNNY_PATTERN =
  /\b(lol|lmao|lmfao|crying|screaming|I am dead|I'm dead|help me|that is hilarious|that's hilarious)\b/i;

const LILITH_PATTERN =
  /\blilith\b/i;

const FAYE_PATTERN =
  /\bfaye\b/i;

function getAmbientChannelIds(): Set<string> {
  const rawChannelIds =
    process.env.FAYE_AMBIENT_CHANNEL_IDS
      ?.trim();

  if (!rawChannelIds) {
    return new Set();
  }

  return new Set(
    rawChannelIds
      .split(",")
      .map((channelId) =>
        channelId.trim()
      )
      .filter(Boolean)
  );
}

function isAmbientEnabled(): boolean {
  return (
    process.env.FAYE_AMBIENT_ENABLED
      ?.trim()
      .toLowerCase() === "true"
  );
}

function isAmbientTestMode(
  message: Message
): boolean {
  const testModeEnabled =
    process.env.FAYE_AMBIENT_TEST_MODE
      ?.trim()
      .toLowerCase() === "true";

  const testChannelId =
    process.env.FAYE_TEST_CHANNEL_ID
      ?.trim();

  return (
    testModeEnabled &&
    Boolean(testChannelId) &&
    message.channel.id === testChannelId
  );
}

function isAmbientChannel(
  message: Message
): boolean {
  if (isAmbientTestMode(message)) {
    return true;
  }

  if (!isAmbientEnabled()) {
    return false;
  }

  const ambientChannelIds =
    getAmbientChannelIds();

  return ambientChannelIds.has(
    message.channel.id
  );
}

function containsFayeWakeWord(
  content: string
): boolean {
  return /\bfaye\b/i.test(content);
}

function cleanFayeMessage(
  content: string,
  botUserId: string
): string {
  return content
    .replace(
      new RegExp(
        `<@!?${botUserId}>`,
        "g"
      ),
      ""
    )
    .replace(
      /^!f\b/i,
      ""
    )
    .replace(
      /\b(?:hey|hello|hi|okay|ok|yo)?\s*faye[\s,:.!?-]*/i,
      ""
    )
    .trim();
}

function getDisplayName(
  message: Message
): string {
  return (
    message.member?.displayName ??
    message.author.displayName ??
    message.author.username
  );
}

async function isReplyToFaye(
  message: Message,
  botUserId: string
): Promise<boolean> {
  if (!message.reference?.messageId) {
    return false;
  }

  try {
    const referencedMessage =
      await message.fetchReference();

    return (
      referencedMessage.author.id ===
      botUserId
    );
  } catch (error) {
    console.error(
      "Failed to check Faye reply reference:",
      error
    );

    return false;
  }
}

function messageIsSuitableForAmbientActivity(
  message: Message
): boolean {
  const content =
    message.content.trim();

  if (
    content.length < 6 ||
    content.length > 1_000 ||
    content.startsWith("/") ||
    content.includes("http://") ||
    content.includes("https://") ||
    SERIOUS_CONTENT_PATTERN.test(content)
  ) {
    return false;
  }

  if (
    message.mentions.everyone ||
    message.mentions.roles.size > 0
  ) {
    return false;
  }

  return true;
}

function getAmbientCommentChance(
  content: string
): number {
  if (isAmbientTestContent(content)) {
    return 1;
  }

  if (LILITH_PATTERN.test(content)) {
    return 0.32;
  }

  if (GOOD_NEWS_PATTERN.test(content)) {
    return 0.3;
  }

  if (PET_PATTERN.test(content)) {
    return 0.2;
  }

  if (
    BOOK_PATTERN.test(content) ||
    GAME_PATTERN.test(content)
  ) {
    return 0.14;
  }

  if (WHOLESOME_PATTERN.test(content)) {
    return 0.18;
  }

  if (FUNNY_PATTERN.test(content)) {
    return 0.1;
  }

  if (content.length >= 80) {
    return 0.025;
  }

  return 0;
}

function isAmbientTestContent(
  content: string
): boolean {
  return content.includes(
    "[FAYE_AMBIENT_TEST]"
  );
}

function ambientCooldownAllowsComment(
  message: Message
): boolean {
  if (isAmbientTestMode(message)) {
    return true;
  }

  const now = Date.now();

  const lastChannelComment =
    ambientChannelCooldowns.get(
      message.channel.id
    ) ?? 0;

  const lastUserComment =
    ambientUserCooldowns.get(
      message.author.id
    ) ?? 0;

  return (
    now - lastChannelComment >=
      AMBIENT_CHANNEL_COOLDOWN_MS &&
    now - lastUserComment >=
      AMBIENT_USER_COOLDOWN_MS
  );
}

function shouldMakeAmbientComment(
  message: Message
): boolean {
  if (
    !messageIsSuitableForAmbientActivity(
      message
    ) ||
    !ambientCooldownAllowsComment(
      message
    )
  ) {
    return false;
  }

  if (isAmbientTestMode(message)) {
    return true;
  }

  const chance =
    getAmbientCommentChance(
      message.content
    );

  return (
    chance > 0 &&
    Math.random() < chance
  );
}

function buildAmbientPrompt(
  message: Message
): string {
  const displayName =
    getDisplayName(message);

  return [
    "Make a rare, unsolicited comment in the Garden of Harmony Discord server.",
    "",
    `The newest message was written by ${displayName}:`,
    message.content.trim(),
    "",
    "Respond directly to what they said.",
    "Write one short natural sentence, or at most two very short sentences.",
    "Sound like Faye: warm, observant, gently playful, and emotionally intelligent.",
    "Do not announce that you were listening, monitoring, or watching the conversation.",
    "Do not use a generic greeting.",
    "Do not describe yourself as a bot or assistant.",
    "Do not give a long speech.",
    "Do not tag anyone.",
    "Do not use a heading or list.",
    "Do not force forest imagery.",
    "If Lilith was mentioned, you may briefly respond as her affectionate younger sister.",
    "If the message contains good news, celebrate it without sounding exaggerated.",
    "If it involves a pet, book, or game, show natural curiosity.",
    "If the message is funny, you may react playfully.",
    "Do not turn serious pain into something whimsical.",
  ].join("\n");
}

async function maybeCommentAsFaye(
  client: Client,
  message: Message
): Promise<boolean> {
  if (
    !isAmbientChannel(message) ||
    !shouldMakeAmbientComment(message)
  ) {
    return false;
  }

  try {
    if (
      "sendTyping" in message.channel
    ) {
      await message.channel.sendTyping();
    }

    const displayName =
      getDisplayName(message);

    const recentMessages =
      await getRecentConversation(
        message.channel.id
      );

    const userMemories =
      await getUserMemories(
        message.author.id
      );

    const response =
      await getFayeResponse(
        buildAmbientPrompt(message),
        displayName,
        recentMessages,
        userMemories
      );

    if (!response.trim()) {
      return false;
    }

    await message.reply({
      content: response,
      allowedMentions: {
        repliedUser: false,
        parse: [],
      },
    });

    const now = Date.now();

    ambientChannelCooldowns.set(
      message.channel.id,
      now
    );

    ambientUserCooldowns.set(
      message.author.id,
      now
    );

    await saveConversationMessage(
      message.channel.id,
      message.author.id,
      message.author.username,
      "user",
      message.content.trim()
    );

    await saveConversationMessage(
      message.channel.id,
      client.user?.id ?? "faye",
      "Faye",
      "assistant",
      response
    );

    return true;
  } catch (error) {
    console.error(
      "Faye ambient comment error:",
      error
    );

    return false;
  }
}

function chooseFayeReaction(
  content: string
): string | null {
  if (GOOD_NEWS_PATTERN.test(content)) {
    return Math.random() < 0.5
      ? "🌟"
      : "🌿";
  }

  if (PET_PATTERN.test(content)) {
    return Math.random() < 0.5
      ? "🥹"
      : "💚";
  }

  if (WHOLESOME_PATTERN.test(content)) {
    return Math.random() < 0.5
      ? "💚"
      : "🌱";
  }

  if (
    BOOK_PATTERN.test(content) ||
    GAME_PATTERN.test(content)
  ) {
    return Math.random() < 0.5
      ? "👀"
      : "🍃";
  }

  if (LILITH_PATTERN.test(content)) {
    return Math.random() < 0.5
      ? "🌙"
      : "🍵";
  }

  if (FUNNY_PATTERN.test(content)) {
    return Math.random() < 0.5
      ? "😂"
      : "🍃";
  }

  if (Math.random() < 0.025) {
    const ordinaryReactions = [
      "🍃",
      "🌿",
      "💚",
    ];

    return ordinaryReactions[
      Math.floor(
        Math.random() *
          ordinaryReactions.length
      )
    ];
  }

  return null;
}

function reactionCooldownAllowsActivity(
  message: Message
): boolean {
  const now = Date.now();

  const lastChannelReaction =
    reactionChannelCooldowns.get(
      message.channel.id
    ) ?? 0;

  const lastUserReaction =
    reactionUserCooldowns.get(
      message.author.id
    ) ?? 0;

  return (
    now - lastChannelReaction >=
      REACTION_CHANNEL_COOLDOWN_MS &&
    now - lastUserReaction >=
      REACTION_USER_COOLDOWN_MS
  );
}

async function maybeReactAsFaye(
  message: Message
): Promise<void> {
  if (
    !isAmbientChannel(message) ||
    !messageIsSuitableForAmbientActivity(
      message
    ) ||
    !reactionCooldownAllowsActivity(
      message
    )
  ) {
    return;
  }

  const reaction =
    chooseFayeReaction(
      message.content
    );

  if (!reaction) {
    return;
  }

  try {
    await message.react(reaction);

    const now = Date.now();

    reactionChannelCooldowns.set(
      message.channel.id,
      now
    );

    reactionUserCooldowns.set(
      message.author.id,
      now
    );
  } catch (error) {
    console.error(
      "Faye reaction error:",
      error
    );
  }
}

async function handleFayeMessage(
  client: Client,
  message: Message,
  content: string
): Promise<void> {
  const userId =
    message.author.id;

  const now =
    Date.now();

  const lastUsed =
    directResponseCooldowns.get(
      userId
    ) ?? 0;

  if (
    now - lastUsed <
    DIRECT_RESPONSE_COOLDOWN_MS
  ) {
    await message.react("🍃");
    return;
  }

  directResponseCooldowns.set(
    userId,
    now
  );

  if (!content) {
    await message.reply({
      content:
        "You called for me? 🌿 Ask me anything—I’m here.",
      allowedMentions: {
        repliedUser: false,
        parse: [],
      },
    });

    return;
  }

  const lowerContent =
    content.toLowerCase();

  if (
    lowerContent.startsWith(
      "remember that "
    )
  ) {
    const memory =
      content
        .slice(
          "remember that ".length
        )
        .trim();

    if (memory) {
      await saveUserMemory(
        message.author.id,
        message.author.username,
        memory
      );

      await message.reply({
        content:
          "I’ll tuck that memory safely into the garden. 🌿",
        allowedMentions: {
          repliedUser: false,
          parse: [],
        },
      });

      return;
    }
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
    naturalMemoryPatterns.some(
      (pattern) =>
        lowerContent.includes(
          pattern
        )
    ) &&
    content.length <= 200
  ) {
    await saveUserMemory(
      message.author.id,
      message.author.username,
      content
    );
  }

  if (
    "sendTyping" in message.channel
  ) {
    await message.channel.sendTyping();
  }

  try {
    const displayName =
      getDisplayName(message);

    await saveConversationMessage(
      message.channel.id,
      message.author.id,
      displayName,
      "user",
      content
    );

    const recentMessages =
      await getRecentConversation(
        message.channel.id
      );

    const userMemories =
      await getUserMemories(
        message.author.id
      );

    const response =
      await getFayeResponse(
        content,
        displayName,
        recentMessages,
        userMemories
      );

    await message.reply({
      content: response,
      allowedMentions: {
        repliedUser: false,
        parse: [],
      },
    });

    await saveConversationMessage(
      message.channel.id,
      client.user?.id ?? "faye",
      "Faye",
      "assistant",
      response
    );
  } catch (error) {
    console.error(
      "Error getting Faye response:",
      error
    );

    await message.react("🍃");
  }
}

async function handleStickyMessage(
  client: Client,
  message: Message
): Promise<void> {
  const [sticky] =
    await db
      .select()
      .from(stickyMessages)
      .where(
        eq(
          stickyMessages.channelId,
          message.channelId
        )
      );

  if (
    !sticky ||
    message.id ===
      sticky.lastMessageId
  ) {
    return;
  }

  const now = Date.now();

  const lastStickyUpdate =
    stickyCooldowns.get(
      message.channel.id
    ) ?? 0;

  if (
    now - lastStickyUpdate <=
    STICKY_COOLDOWN_MS
  ) {
    return;
  }

  stickyCooldowns.set(
    message.channel.id,
    now
  );

  setTimeout(() => {
    updateStickyMessage(
      client,
      message.channel.id
    ).catch(console.error);
  }, 1_000);
}

export default function registerMessageCreateEvent(
  client: Client
): void {
  if (messageCreateRegistered) {
    console.log(
      "messageCreate already registered, skipping"
    );

    return;
  }

  messageCreateRegistered = true;

  console.log(
    "REGISTERING messageCreate event"
  );

  client.on(
    Events.MessageCreate,
    async (message: Message) => {
      try {
        if (
          !message.inGuild() ||
          message.author.bot
        ) {
          return;
        }

        await handleStickyMessage(
          client,
          message
        );

        if (!client.user) {
          return;
        }

        const prefixWasUsed =
          message.content
            .toLowerCase()
            .startsWith(PREFIX);

        const botWasMentioned =
          message.mentions.users.has(
            client.user.id
          );

        const replyingToFaye =
          await isReplyToFaye(
            message,
            client.user.id
          );

        const wakeWordWasUsed =
          isAmbientChannel(message) &&
          containsFayeWakeWord(
            message.content
          );

        const fayeWasSummoned =
          prefixWasUsed ||
          botWasMentioned ||
          replyingToFaye ||
          wakeWordWasUsed;

        if (fayeWasSummoned) {
          const content =
            cleanFayeMessage(
              message.content,
              client.user.id
            );

          await handleFayeMessage(
            client,
            message,
            content
          );

          return;
        }

        if (!isAmbientChannel(message)) {
          return;
        }

        const commented =
          await maybeCommentAsFaye(
            client,
            message
          );

        if (!commented) {
          await maybeReactAsFaye(
            message
          );
        }
      } catch (error) {
        console.error(
          "ERROR INSIDE messageCreate:",
          error
        );
      }
    }
  );
}
