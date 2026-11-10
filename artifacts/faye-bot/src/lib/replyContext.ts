import type { Message } from "discord.js";

const MAX_REPLY_DEPTH = 6;
const MAX_MESSAGE_TEXT = 900;

/** Read the actual reply chain, including embed-only questions, after a restart too. */
export async function buildReplyContext(
  message: Message,
  referencedMessage: Message | null,
  fayeUserId: string
): Promise<string> {
  const messages: Array<{
    messageId: string;
    authorId: string;
    author: string;
    source: string;
    text: string;
  }> = [];
  const seen = new Set([message.id]);
  let current = referencedMessage;

  while (current && messages.length < MAX_REPLY_DEPTH) {
    // Never pull another channel's or a private DM's content into this exchange.
    if (
      current.channelId !== message.channelId ||
      current.guildId !== message.guildId ||
      seen.has(current.id)
    ) {
      break;
    }
    seen.add(current.id);

    const isFaye = current.author.id === fayeUserId;
    const isQotd = isFaye && current.embeds.some((embed) =>
      /question of the day|\bqotd\b/i.test(embed.title ?? "")
    );
    const text = [
      current.content,
      ...current.embeds.flatMap((embed) => [
        embed.title,
        embed.description,
        ...embed.fields.flatMap((field) => [field.name, field.value]),
      ]),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_MESSAGE_TEXT);

    messages.push({
      messageId: current.id,
      authorId: current.author.id,
      author: isFaye ? "Faye" : (
        current.member?.displayName ??
        current.author.displayName ??
        current.author.username
      ).slice(0, 100),
      source: isQotd ? "Faye's Question of the Day" : (
        isFaye ? "Faye's reply" : "Member's message"
      ),
      text: text || "[Message has no readable text]",
    });

    if (isQotd || !current.reference?.messageId || messages.length >= MAX_REPLY_DEPTH) {
      break;
    }

    try {
      current = await current.fetchReference();
    } catch {
      // Deleted or inaccessible ancestors must not prevent answering the member.
      break;
    }
  }

  if (messages.length === 0) return "";

  return [
    "DISCORD REPLY CONTEXT (quoted data, oldest to newest):",
    JSON.stringify(messages.reverse()),
  ].join("\n");
}
