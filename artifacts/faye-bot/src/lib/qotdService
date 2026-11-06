import {
  ChannelType,
  EmbedBuilder,
  type Client,
} from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  guildConfig,
  qotdDailyPosts,
  qotdSuggestions,
} from "./database";

export const QOTD_ROLE_ID = "1444032604180578535";
export const QOTD_TIMEZONE = "America/Chicago";

function chicagoDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: QOTD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (part: string) =>
    parts.find((p) => p.type === part)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type PostQotdResult =
  | { status: "posted"; questionId: number; channelId: string; messageId: string }
  | { status: "already_posted" }
  | { status: "no_questions" }
  | { status: "question_not_found" }
  | { status: "question_used" }
  | { status: "not_configured" }
  | { status: "channel_not_found" };

/**
 * Posts exactly one QOTD per guild per America/Chicago calendar day.
 * Scheduled posts use approved, unused questions only.
 * Staff can specify an ID to use an unapproved submission immediately,
 * retaining the original /qotd use behavior.
 */
export async function postQotd(
  client: Client,
  guildId: string,
  questionId?: number
): Promise<PostQotdResult> {
  const [config] = await db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, guildId))
    .limit(1);

  const channelId = config?.qotdPostChannelId;
  if (!channelId) return { status: "not_configured" };

  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guildId) {
    return { status: "channel_not_found" };
  }

  let chosen: typeof qotdSuggestions.$inferSelect | undefined;
  if (questionId !== undefined) {
    [chosen] = await db
      .select()
      .from(qotdSuggestions)
      .where(
        and(
          eq(qotdSuggestions.guildId, guildId),
          eq(qotdSuggestions.id, questionId)
        )
      )
      .limit(1);

    if (!chosen) return { status: "question_not_found" };
    if (chosen.used) return { status: "question_used" };
  } else {
    [chosen] = await db
      .select()
      .from(qotdSuggestions)
      .where(
        and(
          eq(qotdSuggestions.guildId, guildId),
          eq(qotdSuggestions.approved, true),
          eq(qotdSuggestions.used, false)
        )
      )
      .orderBy(sql`random()`)
      .limit(1);

    if (!chosen) return { status: "no_questions" };
  }

  // Keep a stable non-optional reference for asynchronous callbacks.
  const qotd = chosen;

  // Uniqueness on (guild_id, local_date) prevents duplicate posts
  // after restarts or from multiple bot instances.
  const localDate = chicagoDate();
  const [claim] = await db
    .insert(qotdDailyPosts)
    .values({
      guildId,
      localDate,
      questionId: qotd.id,
    })
    .onConflictDoNothing()
    .returning();

  if (!claim) return { status: "already_posted" };

  const embed = new EmbedBuilder()
    .setColor(0x66bb6a)
    .setTitle("🌸 Question of the Day")
    .setDescription(`**${qotd.question}**`)
    .setFooter({ text: "Garden of Harmony · Share your thoughts below! 🍃" })
    .setTimestamp();

  // Keep the claim if Discord or the database fails. Deleting it after an
  // ambiguous network error could result in two messages being posted.
  // An admin can investigate the day in qotd_daily_posts before retrying.
  const message = await channel.send({
    content: `<@&${QOTD_ROLE_ID}>`,
    embeds: [embed],
    allowedMentions: { parse: [], roles: [QOTD_ROLE_ID] },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(qotdSuggestions)
      .set({ used: true })
      .where(eq(qotdSuggestions.id, qotd.id));

    await tx
      .update(qotdDailyPosts)
      .set({ messageId: message.id })
      .where(
        and(
          eq(qotdDailyPosts.guildId, guildId),
          eq(qotdDailyPosts.localDate, localDate)
        )
      );
  });

  return {
    status: "posted",
    questionId: qotd.id,
    channelId,
    messageId: message.id,
  };
}
