import { ChannelType, type Client } from "discord.js";
import { pool } from "./database";

export const POLL_TIMEZONE = "America/Chicago";

export type PollConfig = {
  guild_id: string;
  channel_id: string | null;
  post_hour: number;
  post_minute: number;
  potd_role_id: string | null;
};
type PollRow = { id: number; question: string; answers: string[] };

export function localParts(date = new Date()): { date: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: POLL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (name: string): string => parts.find(p => p.type === name)?.value ?? "00";
  return {
    date: [get("year"), get("month"), get("day")].join("-"),
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export async function allPollConfigs(): Promise<PollConfig[]> {
  const result = await pool.query<PollConfig>("SELECT * FROM faye_poll_config");
  return result.rows;
}
export async function pollConfig(guildId: string): Promise<PollConfig | undefined> {
  const result = await pool.query<PollConfig>(
    "SELECT * FROM faye_poll_config WHERE guild_id=$1", [guildId]);
  return result.rows[0];
}
export async function setChannel(guildId: string, channelId: string): Promise<void> {
  await pool.query(
    "INSERT INTO faye_poll_config (guild_id,channel_id) VALUES ($1,$2) " +
    "ON CONFLICT (guild_id) DO UPDATE SET channel_id=EXCLUDED.channel_id",
    [guildId, channelId]);
}
export async function setTime(guildId: string, hour: number, minute: number): Promise<void> {
  await pool.query(
    "INSERT INTO faye_poll_config (guild_id,post_hour,post_minute) VALUES ($1,$2,$3) " +
    "ON CONFLICT (guild_id) DO UPDATE SET post_hour=EXCLUDED.post_hour,post_minute=EXCLUDED.post_minute",
    [guildId, hour, minute]);
}

export function parsePoll(input: string): { question: string; answers: string[]; key: string } {
  const fields = input.trim().replace(/^(?:[-*•]|\d{1,3}[.)])\s+/, "")
    .split("|").map(x => x.trim());
  const [question, ...answers] = fields;
  if (!question || question.length > 300) throw Error("Question must be 1–300 characters.");
  if (answers.length < 2 || answers.length > 10) throw Error("Provide 2–10 answers separated by |.");
  if (answers.some(x => !x || x.length > 55)) throw Error("Answers must be 1–55 characters.");
  const normalize = (x: string): string => x.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  if (new Set(answers.map(normalize)).size !== answers.length) throw Error("Answer choices must be distinct.");
  return { question, answers, key: normalize(question) };
}

export async function importPolls(
  guildId: string, author: string, text: string, approved: boolean
): Promise<{ added: number; duplicates: number; invalid: string[] }> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) throw Error("No poll questions found.");
  if (lines.length > 250) throw Error("Import at most 250 polls per batch.");
  let added = 0, duplicates = 0;
  const invalid: string[] = [];
  // We keep the original entries, including posted ones, to prevent reuse.
  for (let i = 0; i < lines.length; i++) {
    try {
      const p = parsePoll(lines[i]);
      const result = await pool.query(
        "INSERT INTO faye_poll_entries (guild_id,submitted_by,question,question_key,answers,approved) " +
        "VALUES ($1,$2,$3,$4,$5::jsonb,$6) " +
        "ON CONFLICT (guild_id,question_key) DO NOTHING RETURNING id",
        [guildId, author, p.question, p.key, JSON.stringify(p.answers), approved]);
      if (result.rowCount) added++; else duplicates++;
    } catch (err) {
      if (err instanceof Error && /Question must|Provide 2|Answers must|Answer choices/.test(err.message)) {
        invalid.push("Line " + (i + 1) + ": " + err.message);
      } else throw err;
    }
  }
  return { added, duplicates, invalid };
}

export type PostPollResult = {
  status: "posted" | "already_posted" | "not_configured" | "channel_not_found" | "no_polls" | "poll_not_found";
  id?: number; channelId?: string; messageId?: string;
};

/** A durable daily claim prevents duplicate posts, including across restarts.
 * If Discord send fails ambiguously, retain the claim until staff check logs and history.
 */
export async function postPoll(
  client: Client, guildId: string, requestedId?: number
): Promise<PostPollResult> {
  const config = await pollConfig(guildId);
  if (!config?.channel_id) return { status: "not_configured" };
  const channel = await client.channels.fetch(config.channel_id);
  if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guildId) {
    return { status: "channel_not_found" };
  }
  const date = localParts().date;
  const existing = await pool.query(
    "SELECT 1 FROM faye_daily_poll_posts WHERE guild_id=$1 AND local_date=$2", [guildId, date]);
  if (existing.rowCount) return { status: "already_posted" };

  const filters = ["guild_id=$1", "approved=TRUE", "used=FALSE",
    "id NOT IN (SELECT poll_id FROM faye_daily_poll_posts)"];
  const args: (string | number)[] = [guildId];
  if (requestedId !== undefined) { args.push(requestedId); filters.push("id=$2"); }
  const found = await pool.query<PollRow>(
    "SELECT id,question,answers FROM faye_poll_entries WHERE " + filters.join(" AND ") +
    (requestedId === undefined ? " ORDER BY random()" : "") + " LIMIT 1", args);
  const poll = found.rows[0];
  if (!poll) return { status: requestedId === undefined ? "no_polls" : "poll_not_found" };

  const claim = await pool.query(
    "INSERT INTO faye_daily_poll_posts (guild_id,local_date,poll_id) VALUES ($1,$2,$3) " +
    "ON CONFLICT DO NOTHING RETURNING poll_id", [guildId, date, poll.id]);
  if (!claim.rowCount) return { status: "already_posted" };

  // Native Discord poll, 24 hours, single selection, and the separate @POTD ping.
  const message = await channel.send({
    content: (config.potd_role_id ? `<@&${config.potd_role_id}> ` : "") + "🗳️ **Daily Poll · Garden of Harmony**",
    poll: {
      question: { text: poll.question },
      answers: poll.answers.map(text => ({ text })),
      duration: 24,
      allowMultiselect: false,
    },
    allowedMentions: { parse: [], roles: config.potd_role_id ? [config.potd_role_id] : [] },
  });
  await pool.query("UPDATE faye_poll_entries SET used=TRUE WHERE id=$1", [poll.id]);
  await pool.query(
    "UPDATE faye_daily_poll_posts SET message_id=$1 WHERE guild_id=$2 AND local_date=$3",
    [message.id, guildId, date]);
  return { status: "posted", id: poll.id, channelId: channel.id, messageId: message.id };
}
