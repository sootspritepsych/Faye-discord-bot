import { Client, TextChannel, ChannelType } from "discord.js";
import { and, eq } from "drizzle-orm";
import { db, adultQotdQuestions, guildConfig } from "./database";

const postedToday = new Set<string>();

export function startAdultQotdScheduler(client: Client) {
  setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const todayKey = now.toISOString().slice(0, 10);

      const configs = await db.select().from(guildConfig);

      for (const config of configs) {
        if (!config.adultQotdChannelId) continue;
        if ((config.adultQotdPostHour ?? 20) !== hour) continue;

        const postKey = `${config.guildId}-${todayKey}`;
        if (postedToday.has(postKey)) continue;

        const questionRows = await db
          .select()
          .from(adultQotdQuestions)
          .where(
            and(
              eq(adultQotdQuestions.guildId, config.guildId),
              eq(adultQotdQuestions.used, false)
            )
          )
          .limit(1);

        if (questionRows.length === 0) continue;

        const question = questionRows[0];

        const channel = await client.channels.fetch(config.adultQotdChannelId);

        if (!channel || channel.type !== ChannelType.GuildText) continue;

        await (channel as TextChannel).send({
          content:
            `🌹 **Adult QOTD**\n\n` +
            `${question.question}\n\n` +
            `Keep it respectful. Verified 18+ only.`,
        });

        await db
          .update(adultQotdQuestions)
          .set({ used: true })
          .where(eq(adultQotdQuestions.id, question.id));

        postedToday.add(postKey);
      }
    } catch (err) {
      console.error("Adult QOTD scheduler error:", err);
    }
  }, 60 * 1000);
}
