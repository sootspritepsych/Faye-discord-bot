import cron from "node-cron";
import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { db, adultQotdQuestions, guildConfig } from "./database";
import { eq, and } from "drizzle-orm";

const DEFAULT_ADULT_QOTD = [
  "What's your biggest green flag in a partner?",
  "What's your biggest dating red flag?",
  "What's the most attractive personality trait?",
  "What's your ideal date night?",
  "What's your biggest relationship hot take?",
];

export async function startAdultQotdScheduler(client: Client) {
  cron.schedule("0 * * * *", async () => {
    const now = new Date();
    const currentHour = now.getUTCHours();

    const allConfigs = await db.select().from(guildConfig);

    for (const config of allConfigs) {
      if (!config.adultQotdChannelId) continue;
      if ((config.adultQotdPostHour ?? 20) !== currentHour) continue;

      try {
        await postDailyAdultQotd(
          client,
          config.guildId,
          config.adultQotdChannelId
        );
      } catch (err) {
        console.error(
          `Error posting Adult QOTD for guild ${config.guildId}:`,
          err
        );
      }
    }
  });

  console.log("🌹 Adult QOTD scheduler started");
}

export async function postDailyAdultQotd(
  client: Client,
  guildId: string,
  channelId: string
) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const [unused] = await db
    .select()
    .from(adultQotdQuestions)
    .where(
      and(
        eq(adultQotdQuestions.guildId, guildId),
        eq(adultQotdQuestions.used, false)
      )
    )
    .limit(1);

  let question: string;

  if (unused) {
    question = unused.question;

    await db
      .update(adultQotdQuestions)
      .set({ used: true })
      .where(eq(adultQotdQuestions.id, unused.id));
  } else {
    const all = await db
      .select()
      .from(adultQotdQuestions)
      .where(eq(adultQotdQuestions.guildId, guildId));

    if (all.length > 0) {
      await db
        .update(adultQotdQuestions)
        .set({ used: false })
        .where(eq(adultQotdQuestions.guildId, guildId));

      const random = all[Math.floor(Math.random() * all.length)];
      question = random.question;

      await db
        .update(adultQotdQuestions)
        .set({ used: true })
        .where(eq(adultQotdQuestions.id, random.id));
    } else {
      question =
        DEFAULT_ADULT_QOTD[Math.floor(Math.random() * DEFAULT_ADULT_QOTD.length)];
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xff8fab)
    .setTitle("🌹 Adult QOTD")
    .setDescription(question)
    .setTimestamp();

 await (channel as TextChannel).send({
  content: "<@&1395888174609338440>",
  embeds: [embed],
});
