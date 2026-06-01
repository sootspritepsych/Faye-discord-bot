import cron from "node-cron";
import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { db, wisdomQuotes, guildConfig } from "./database";
import { eq, and } from "drizzle-orm";

const DEFAULT_WISDOM = [
  "Every flower blooms at its own pace. Your path is unfolding exactly as it should.",
  "Even the quietest corner of the garden holds something beautiful.",
  "The forest does not hurry, yet everything is accomplished.",
  "A gentle rain nourishes more than a storm ever could.",
  "Roots must grow deep before branches can reach the sky.",
  "The lantern does not ask why it shines — it simply does.",
  "Some paths are meant to be wandered slowly.",
  "Every gardener begins as a seedling.",
  "The garden is most beautiful when tended with kindness.",
  "Even on cloudy days, the flowers still grow.",
];

export async function startWisdomScheduler(client: Client) {
  // Run every hour, check each guild's post time
  cron.schedule("0 * * * *", async () => {
    const now = new Date();
    const currentHour = now.getUTCHours();

    const allConfigs = await db.select().from(guildConfig);

    for (const config of allConfigs) {
      if (!config.wisdomChannelId) continue;
      if ((config.wisdomPostHour ?? 8) !== currentHour) continue;

      try {
        await postDailyWisdom(client, config.guildId, config.wisdomChannelId, config.wisdomPingRoleId);
      } catch (err) {
        console.error(`Error posting daily wisdom for guild ${config.guildId}:`, err);
      }
    }
  });

  console.log("🌿 Daily wisdom scheduler started");
}

export async function postDailyWisdom(client: Client, guildId: string, channelId: string, pingRoleId?: string | null) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  // Try to get an unused guild quote first
  const [unused] = await db
    .select()
    .from(wisdomQuotes)
    .where(and(eq(wisdomQuotes.guildId, guildId), eq(wisdomQuotes.used, false)))
    .limit(1);

  let quote: string;

  if (unused) {
    quote = unused.content;
    await db.update(wisdomQuotes).set({ used: true }).where(eq(wisdomQuotes.id, unused.id));
  } else {
    // Reset all quotes for this guild and pick one
    const all = await db.select().from(wisdomQuotes).where(eq(wisdomQuotes.guildId, guildId));

    if (all.length > 0) {
      // Reset used flags
      await db.update(wisdomQuotes).set({ used: false }).where(eq(wisdomQuotes.guildId, guildId));
      const random = all[Math.floor(Math.random() * all.length)];
      quote = random.content;
      await db.update(wisdomQuotes).set({ used: true }).where(eq(wisdomQuotes.id, random.id));
    } else {
      // Fall back to built-in quotes
      quote = DEFAULT_WISDOM[Math.floor(Math.random() * DEFAULT_WISDOM.length)];
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xa5d6a7)
    .setTitle("🍃 Faye's Daily Wisdom")
    .setDescription(`*"${quote}"*`)
    .setFooter({ text: "— Sprout 🌱 · Garden of Harmony" })
    .setTimestamp();

  const content = pingRoleId ? `<@&${pingRoleId}>` : undefined;
  await (channel as TextChannel).send({ content, embeds: [embed] });
}
