import { createHash } from "node:crypto";
import { ChannelType, type Client, PermissionFlagsBits, type TextChannel } from "discord.js";
import { sql } from "drizzle-orm";
import { db } from "./database";
import {
  COMMUNITY_PROMPTS, communityDay, communityPromptText, dueCommunityPrompts,
  normalizedCommunityName, type PromptPlan,
} from "./communityPromptPlan";

const GUARDIAN = "faye";
const table = sql.raw("faye_community_prompt_posts");
let started = false;

async function resolveCommunityChannel(client: Client, plan: PromptPlan): Promise<TextChannel> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) throw new Error("DISCORD_GUILD_ID is required for community prompts");
  const guild = await client.guilds.fetch(guildId);
  const configured = process.env[plan.env]?.trim();
  let channel;
  if (configured) {
    channel = await guild.channels.fetch(configured);
  } else {
    const channels = await guild.channels.fetch();
    const matches = channels.filter(candidate => candidate?.type === ChannelType.GuildText &&
      normalizedCommunityName(candidate.name) === plan.name);
    if (matches.size !== 1) throw new Error(`Set ${plan.env}: expected one unique ${plan.name} channel`);
    channel = matches.first();
  }
  if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guildId || channel.nsfw) {
    throw new Error(`${plan.env} must identify a regular text channel in the home server`);
  }
  const me = guild.members.me ?? await guild.members.fetchMe();
  if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory])) {
    throw new Error(`Missing View Channel, Send Messages or Read Message History in #${channel.name}`);
  }
  return channel;
}

export async function runCommunityPromptTick(client: Client, now = new Date()): Promise<void> {
  if (process.env.COMMUNITY_PROMPTS_ENABLED === "false") return;
  const day = communityDay(now);
  for (const plan of dueCommunityPrompts(now, GUARDIAN)) {
    try {
      const channel = await resolveCommunityChannel(client, plan);
      const content = communityPromptText(plan, now);
      // Reserving before the Discord request prevents concurrent ticks and restarts from duplicating a post.
      const claimed = await db.execute(sql`
        INSERT INTO ${table} (guild_id, topic, local_date, channel_id, content, status)
        VALUES (${channel.guildId}, ${plan.topic}, ${day.date}, ${channel.id}, ${content}, 'sending')
        ON CONFLICT (guild_id, topic, local_date) DO NOTHING RETURNING topic;
      `);
      if (!claimed.rows.length) continue;
      let messageId: string;
      try {
        const message = await channel.send({
          content: `**🌿 A little check-in from Faye**\n\n${content}\n\n*Reply to this message if you would like to chat with me.*`,
          allowedMentions: { parse: [] },
          nonce: createHash("sha256").update(`${GUARDIAN}:${channel.guildId}:${plan.topic}:${day.date}`).digest("hex").slice(0, 24),
          enforceNonce: true,
        });
        messageId = message.id;
      } catch (error) {
        // An ambiguous send failure is recorded, never automatically retried.
        await db.execute(sql`UPDATE ${table} SET status = 'failed'
          WHERE guild_id = ${channel.guildId} AND topic = ${plan.topic} AND local_date = ${day.date}`);
        throw error;
      }
      await db.execute(sql`UPDATE ${table} SET status = 'posted', message_id = ${messageId}
        WHERE guild_id = ${channel.guildId} AND topic = ${plan.topic} AND local_date = ${day.date}`);
      console.log(`[${GUARDIAN} community] Posted ${plan.topic} prompt ${messageId} in ${channel.id}`);
    } catch (error) {
      // A missing channel must not stop the other weekly prompts.
      console.error(`[${GUARDIAN} community] ${plan.topic}:`, error);
    }
  }
}

export function startCommunityPrompts(client: Client): void {
  if (started || process.env.COMMUNITY_PROMPTS_ENABLED === "false") return;
  started = true;
  void (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ${table} (
      guild_id TEXT NOT NULL, topic TEXT NOT NULL, local_date TEXT NOT NULL,
      channel_id TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL,
      message_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, topic, local_date)
    )`);
    for (const plan of COMMUNITY_PROMPTS.filter(plan => plan.guardian === GUARDIAN || plan.guardian === "alternate")) {
      try {
        const channel = await resolveCommunityChannel(client, plan);
        console.log(`[${GUARDIAN} community] Ready: ${plan.topic} → #${channel.name} (${channel.id})`);
      } catch (error) { console.error(`[${GUARDIAN} community] Channel setup:`, error); }
    }
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try { await runCommunityPromptTick(client); }
      catch (error) { console.error(`[${GUARDIAN} community]`, error); }
      finally { busy = false; }
    };
    await tick();
    setInterval(() => void tick(), 60_000).unref();
    console.log(`[${GUARDIAN} community] Weekly prompts started (17:00 America/Chicago)`);
  })().catch(error => {
    started = false;
    console.error(`[${GUARDIAN} community] Initialization failed:`, error);
  });
}
