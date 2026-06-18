import cron from "node-cron";
import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { db, qotdSuggestions, guildConfig } from "./database";
import { eq, and } from "drizzle-orm";

export async function startQotdScheduler(client: Client) {
  // Run every hour, check each guild's post time
  cron.schedule("15 * * * *", async () => {
    const now = new Date();
    const currentHour = now.getUTCHours();

    const allConfigs = await db.select().from(guildConfig);

    for (const config of allConfigs) {
      if (!config.qotdPostChannelId) continue;
      if ((config.qotdPostHour ?? 9) !== currentHour) continue;

      try {
        await postScheduledQotd(client, config.guildId, config.qotdPostChannelId);
      } catch (err) {
        console.error(`Error posting scheduled QOTD for guild ${config.guildId}:`, err);
      }
    }
  });

  console.log("🌸 QOTD scheduler started");
}

async function postScheduledQotd(client: Client, guildId: string, channelId: string) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const [next] = await db
    .select()
    .from(qotdSuggestions)
    .where(and(eq(qotdSuggestions.guildId, guildId), eq(qotdSuggestions.used, false)))
    .limit(1);

  if (!next) {
    console.log(`No pending QOTD questions for guild ${guildId} — skipping auto-post`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x66bb6a)
    .setTitle("🌸 Question of the Day")
    .setDescription(`**${next.question}**`)
    .setFooter({ text: "Garden of Harmony · Share your thoughts below! 🍃" })
    .setTimestamp();

  await (channel as TextChannel).send({ embeds: [embed] });
  await db.update(qotdSuggestions).set({ used: true }).where(eq(qotdSuggestions.id, next.id));
  console.log(`🌸 Auto-posted QOTD #${next.id} for guild ${guildId}`);
}
