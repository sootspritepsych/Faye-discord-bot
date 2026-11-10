import { randomInt, createHash } from "node:crypto";
import { Client, ChannelType, Events, PermissionFlagsBits, type Guild, type Message } from "discord.js";
import { sql } from "drizzle-orm";
import { db } from "./database";
import { jamDay, isSongMood, leastPlayed, normalizedJamName, songCandidates, songText, type Sister, type SongMood } from "./jamRoomCatalog";

const SISTER: Sister = "faye";
const homeGuild = () => process.env.DISCORD_GUILD_ID?.trim();
let initialized = false;
let started = false;
let busy = false;
export async function initializeSongPosts(): Promise<void> {
  if (initialized) return;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS jam_room_song_posts (
    post_key TEXT PRIMARY KEY, guild_id TEXT NOT NULL, local_date TEXT NOT NULL,
    sister TEXT NOT NULL, track_id TEXT NOT NULL, message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  initialized = true;
}
export async function getJamRoom(guild: Guild) {
  const channels = await guild.channels.fetch();
  const configured = process.env.JAM_ROOM_CHANNEL_ID?.trim();
  const matches = channels.filter(c => c !== null &&
    (configured ? c.id === configured : normalizedJamName(c.name) === "jamroom") &&
    [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice].includes(c.type));
  if (matches.size !== 1) throw new Error("Set JAM_ROOM_CHANNEL_ID: expected exactly one jam-room channel.");
  const channel = matches.first()!;
  if (!channel.isTextBased() || !channel.isSendable()) throw new Error("The jam room cannot receive messages.");
  const me = guild.members.me ?? await guild.members.fetchMe();
  if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw new Error(`${SISTER} needs View Channel and Send Messages in the jam room.`);
  }
  return channel;
}

/** Reserve before sending so overlapping deploys and restarts cannot post twice.
 * An ambiguous Discord delivery stays reserved; inspect logs instead of retrying blindly.
 */
export async function postSong(guild: Guild, postKey: string, mood: SongMood, replyTo?: string): Promise<Message | null> {
  if (guild.id !== homeGuild()) throw new Error("Song posts are restricted to the home server.");
  await initializeSongPosts();
  const channel = await getJamRoom(guild);
  const day = jamDay();
  if (day.sister !== SISTER) return null;
  const song = await db.transaction(async tx => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${"jam-songs:" + guild.id})) AS locked`);
    if (!lock.rows[0]?.locked) return null;
    const exists = await tx.execute(sql`SELECT 1 FROM jam_room_song_posts WHERE post_key = ${postKey}`);
    if (exists.rows.length) return null;
    const rows = await tx.execute(sql`SELECT track_id, COUNT(*)::int AS n FROM jam_room_song_posts WHERE guild_id = ${guild.id} GROUP BY track_id`);
    const counts = new Map(rows.rows.map(r => [String(r.track_id), Number(r.n)]));
    const choices = leastPlayed(songCandidates(SISTER, mood), counts);
    if (!choices.length) throw new Error("No songs match that mood.");
    const chosen = choices[randomInt(choices.length)];
    const inserted = await tx.execute(sql`INSERT INTO jam_room_song_posts (post_key,guild_id,local_date,sister,track_id)
      VALUES (${postKey},${guild.id},${day.date},${SISTER},${chosen.id}) ON CONFLICT DO NOTHING RETURNING post_key`);
    return inserted.rows.length ? chosen : null;
  });
  if (!song) return null;
  let sent: Message;
  try {
    sent = await channel.send({
      content: songText(SISTER, song, replyTo ? mood : undefined),
      allowedMentions: { parse: [], repliedUser: false },
      nonce: createHash("sha256").update(postKey).digest("hex").slice(0,24), enforceNonce: true,
      ...(replyTo ? { reply: { messageReference: replyTo, failIfNotExists: false } } : {}),
    });
  } catch (error) {
    console.error(`[jam-room] ${postKey} delivery failed or is uncertain; reservation retained to prevent duplicates.`, error);
    throw error;
  }
  await db.execute(sql`UPDATE jam_room_song_posts SET message_id = ${sent.id} WHERE post_key = ${postKey}`)
    .catch(error => console.error("[jam-room] Sent successfully; failed to record message ID", error));
  return sent;
}

export function startJamRoomSongs(client: Client): void {
  if (started) return;
  started = true;
  const tick = async () => {
    if (busy || process.env.JAM_ROOM_SONGS_ENABLED === "false") return;
    busy = true;
    try {
      const guildId = homeGuild();
      if (!guildId) throw new Error("Home guild ID is missing.");
      await initializeSongPosts();
      const day = jamDay();
      // Only today's hour; no surprise catch-up posts late at night after a restart.
      const hour = Number(process.env.JAM_ROOM_POST_HOUR ?? "17");
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("Invalid JAM_ROOM_POST_HOUR.");
      if (day.sister !== SISTER || day.hour !== hour) return;
      const guild = await client.guilds.fetch(guildId);
      await postSong(guild, `daily:${guildId}:${day.date}`, "surprise");
    } catch (error) { console.error("[jam-room] Scheduler:", error); }
    finally { busy = false; }
  };
  setInterval(() => { void tick(); }, 60_000).unref();
  void tick();
  void (async () => {
    const id = homeGuild();
    if (!id) return;
    const channel = await getJamRoom(await client.guilds.fetch(id));
    console.log(`[jam-room] ${SISTER} ready in #${channel.name} (${channel.id}); alternating daily at ${process.env.JAM_ROOM_POST_HOUR ?? "17"}:00 America/Chicago.`);
  })().catch(error => console.error("[jam-room] Channel setup:", error));
  
}
