import { ChannelType, Client, EmbedBuilder, PermissionFlagsBits, type TextChannel } from "discord.js";
import { sql } from "drizzle-orm";
import { db } from "./database";
import { CONFESSION_LINES } from "./guardianConfessionLines";
import { chooseConfession, confessionWeek, randomConfessionTime, WEEK_MS } from "./guardianConfessionPlan";


const BOT = "faye";
const table = sql.raw("faye_guardian_confession_posts");
let started = false;

async function resolveChannel(client: Client): Promise<TextChannel | null> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) throw new Error("DISCORD_GUILD_ID is required for weekly guardian confessions");
  
  const guild = await client.guilds.fetch(guildId);
  let channelId = process.env.CONFESSIONS_CHANNEL_ID?.trim();
  if (!channelId) {
    const config = await db.execute(sql`SELECT confessions_channel_id FROM faye_guild_config WHERE guild_id = ${guildId} LIMIT 1`);
    channelId = config.rows[0]?.confessions_channel_id ? String(config.rows[0].confessions_channel_id) : undefined;
  }
  if (!channelId) {
    // Only accept a single exact name after removing emoji and punctuation.
    const channels = await guild.channels.fetch();
    const matches = channels.filter(channel => channel?.type === ChannelType.GuildText &&
      /^confessions?$/i.test(channel.name.replace(/[^a-z]/gi, "")));
    if (matches.size !== 1) throw new Error("Set CONFESSIONS_CHANNEL_ID: could not identify one unique confessions channel");
    channelId = matches.first()!.id;
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guildId) {
    throw new Error("The confessions channel must be a text channel in the home server");
  }
  const me = guild.members.me ?? await guild.members.fetchMe();
  if (!channel.permissionsFor(me)?.has([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
  ])) throw new Error("Missing View Channel, Send Messages, or Embed Links in confessions");
  return channel;
}

export async function runGuardianConfessionTick(client: Client): Promise<void> {
  const channel = await resolveChannel(client);
  if (!channel) return;
  const now = new Date();
  const week = confessionWeek(now);
  // Plan this week and the next. Inserting once preserves random times across restarts.
  for (const start of [week, new Date(week.getTime() + WEEK_MS)]) {
    const existing = await db.execute(sql`
      SELECT week_start FROM ${table}
      WHERE guild_id = ${channel.guildId} AND week_start = ${start};
    `);
    if (existing.rows.length) continue;
    const recent = await db.execute(sql`
      SELECT content FROM ${table} WHERE guild_id = ${channel.guildId}
      ORDER BY week_start DESC LIMIT ${CONFESSION_LINES.length - 1};
    `);
    const content = chooseConfession(CONFESSION_LINES, recent.rows.map(row => String(row.content)));
    const due = randomConfessionTime(start, now);
    const inserted = await db.execute(sql`
      INSERT INTO ${table} (guild_id, week_start, scheduled_at, content)
      VALUES (${channel.guildId}, ${start}, ${due}, ${content})
      ON CONFLICT (guild_id, week_start) DO NOTHING RETURNING scheduled_at;
    `);
    if (inserted.rows.length) console.log(`[${BOT} confessions] Scheduled for ${due.toISOString()} in channel ${channel.id}`);
  }
  // Atomically claim before sending: concurrent ticks, replicas and restarts cannot double-post.
  // Expired weeks are intentionally skipped, so downtime never creates a backlog burst.
  const claimed = await db.execute(sql`
    UPDATE ${table} SET status = 'sending', attempted_at = NOW()
    WHERE guild_id = ${channel.guildId} AND week_start = ${week}
      AND scheduled_at <= NOW() AND status = 'pending'
    RETURNING content, week_start;
  `);
  for (const row of claimed.rows) {
    let messageId: string;
    try {
      const message = await channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xa5d6a7)
          .setTitle("🌸 Faye has a confession…")
          .setDescription(String(row.content))
          .setFooter({ text: "— Faye · A Guardian's Confession · Garden of Harmony" })
          .setTimestamp()],
        allowedMentions: { parse: [] },
      });
      messageId = message.id;
    } catch (error) {
      // Do not automatically retry an ambiguous Discord failure: it may have delivered.
      await db.execute(sql`
        UPDATE ${table} SET status = 'failed'
        WHERE guild_id = ${channel.guildId} AND week_start = ${week};
      `);
      throw error;
    }
    await db.execute(sql`
      UPDATE ${table} SET status = 'posted', message_id = ${messageId}
      WHERE guild_id = ${channel.guildId} AND week_start = ${week};
    `);
    console.log(`[${BOT} confessions] Posted ${messageId}`);
  }
}

export function startGuardianConfessions(client: Client): void {
  if (started || process.env.GUARDIAN_CONFESSIONS_ENABLED === "false") return;
  started = true;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runGuardianConfessionTick(client); }
    catch (error) { console.error(`[${BOT} confessions]`, error); }
    finally { busy = false; }
  };
  void (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${table} (
        guild_id TEXT NOT NULL,
        week_start TIMESTAMPTZ NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempted_at TIMESTAMPTZ,
        message_id TEXT,
        PRIMARY KEY (guild_id, week_start)
      );
    `);
    await tick();
    setInterval(() => void tick(), 60_000).unref();
    console.log(`[${BOT} confessions] Weekly scheduler started`);
  })().catch(error => {
    started = false;
    console.error(`[${BOT} confessions] Initialization failed`, error);
  });
}
