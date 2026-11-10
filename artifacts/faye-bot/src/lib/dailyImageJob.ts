import cron from "node-cron";
import { ChannelType, EmbedBuilder, PermissionFlagsBits, type Client } from "discord.js";
import type { Pool } from "pg";

export interface DailyImage {
  id: string;
  title: string;
  image: string;
  source: string;
  credit: string;
}

interface Options {
  key: string;
  guildId: string;
  channelId?: string;
  channelNames: string[];
  hour: number;
  content: string;
  pool: Pool;
  pick: (recent: Set<string>) => Promise<DailyImage>;
}

export const IMAGE_TIMEZONE = "America/Chicago";

export function imagePostTime(date = new Date()): { day: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IMAGE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minute: +get("hour") * 60 + +get("minute") };
}

function normalizedName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function resolveImageChannel(client: Client, options: Options) {
  const guild = await client.guilds.fetch(options.guildId);
  const channels = await guild.channels.fetch();
  const candidates = channels.filter(channel => channel !== null &&
    (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
    (options.channelId ? channel.id === options.channelId :
      options.channelNames.includes(normalizedName(channel.name))));
  if (candidates.size !== 1) {
    throw new Error(`${options.key}: expected one matching channel, found ${candidates.size}`);
  }
  const channel = candidates.first()!;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    throw new Error(`${options.key}: destination is not a text channel`);
  }
  const me = guild.members.me ?? await guild.members.fetchMe();
  if (!channel.permissionsFor(me)?.has([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
  ])) throw new Error(`${options.key}: missing View Channel, Send Messages or Embed Links permission`);
  return channel;
}

/** Pick before claiming so provider failures can retry. Once a Discord send starts,
 * keep the claim even on timeout: its outcome may be unknown. Avoid duplicate posts. */
export async function postDailyImage(client: Client, options: Options, date = new Date()): Promise<string> {
  const { day } = imagePostTime(date);
  const existing = await options.pool.query(
    "SELECT 1 FROM daily_image_posts WHERE job_key=$1 AND guild_id=$2 AND local_date=$3",
    [options.key, options.guildId, day],
  );
  if (existing.rows.length) return "already_posted";
  const channel = await resolveImageChannel(client, options);
  const history = await options.pool.query<{ image_key: string }>(
    "SELECT image_key FROM daily_image_posts WHERE job_key=$1 AND guild_id=$2 ORDER BY local_date DESC LIMIT 60",
    [options.key, options.guildId],
  );
  const item = await options.pick(new Set(history.rows.map(row => row.image_key)));
  const embed = new EmbedBuilder().setTitle(item.title.slice(0, 256))
    .setURL(item.source).setImage(item.image).setFooter({ text: item.credit.slice(0, 2048) });
  const claim = await options.pool.query(
    "INSERT INTO daily_image_posts (job_key,guild_id,local_date,channel_id,image_key) " +
    "VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING local_date",
    [options.key, options.guildId, day, channel.id, item.id],
  );
  if (!claim.rows.length) return "already_posted";
  try {
    const message = await channel.send({
      content: options.content, embeds: [embed], allowedMentions: { parse: [] },
    });
    await options.pool.query(
      "UPDATE daily_image_posts SET message_id=$1 WHERE job_key=$2 AND guild_id=$3 AND local_date=$4",
      [message.id, options.key, options.guildId, day],
    );
    console.log(`📷 ${options.key}: posted in #${channel.name} (${channel.id}), message ${message.id}`);
    return "posted";
  } catch (error) {
    console.error(`📷 ${options.key}: send or receipt failed; daily claim retained to prevent duplicates`, error);
    return "send_uncertain";
  }
}

export async function startDailyImageJob(client: Client, options: Options): Promise<void> {
  await options.pool.query(`CREATE TABLE IF NOT EXISTS daily_image_posts (
    job_key TEXT NOT NULL, guild_id TEXT NOT NULL, local_date TEXT NOT NULL,
    channel_id TEXT NOT NULL, image_key TEXT NOT NULL, message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (job_key,guild_id,local_date)
  )`);
  const checkChannel = async () => {
    const channel = await resolveImageChannel(client, options);
    console.log(`📷 ${options.key}: destination #${channel.name} (${channel.id}); daily ${options.hour}:00 ${IMAGE_TIMEZONE}`);
  };
  // Check the destination on boot without sending an unsolicited test message.
  await checkChannel().catch(error => console.error(`📷 ${options.key}: channel check failed`, error));
  await options.pick(new Set()).then(() => {
    console.log(`📷 ${options.key}: image provider ready (startup check only; no message sent)`);
  }).catch(error => console.error(`📷 ${options.key}: image provider check failed`, error));
  let running = false;
  const tick = async () => {
    const now = imagePostTime();
    const minutesLate = now.minute - options.hour * 60;
    // Retry provider failures briefly, including a restart during this window.
    if (running || minutesLate < 0 || minutesLate >= 15) return;
    running = true;
    try { await postDailyImage(client, options); }
    catch (error) { console.error(`📷 ${options.key}: scheduled post failed`, error); }
    finally { running = false; }
  };
  cron.schedule("* * * * *", () => { void tick(); }, { timezone: IMAGE_TIMEZONE });
  void tick();
}
