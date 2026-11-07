import { pool } from "./database";
import { parsePoll } from "./pollService";
import { YEAR_POLL_CANDIDATES } from "./pollYear365";
import { QOTD_YEAR_A } from "./qotdYearA";
import { QOTD_YEAR_B } from "./qotdYearB";
import { QOTD_YEAR_C } from "./qotdYearC";

export const ANNUAL_QUEUE_TARGET = 365;

type Counts = {
  total: number;
  added: number;
  available: number;
  candidates: number;
};

function qotdKey(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

async function fillQotdQueue(guildId: string, query: (sql: string, values?: unknown[]) => Promise<any>): Promise<Counts> {
  // All existing QOTDs are preserved, even unapproved member suggestions and posted questions.
  const existing = await query(
    "SELECT question FROM faye_qotd_suggestions WHERE guild_id=$1",
    [guildId]
  );
  const approved = await query(
    "SELECT COUNT(*)::int AS count FROM faye_qotd_suggestions " +
    "WHERE guild_id=$1 AND approved=TRUE",
    [guildId]
  );
  const before = Number(approved.rows[0]?.count ?? 0);
  const seen = new Set<string>(existing.rows.map((r: { question: string }) => qotdKey(r.question)));
  const candidates = [...QOTD_YEAR_A, ...QOTD_YEAR_B, ...QOTD_YEAR_C];
  const selected: string[] = [];
  const needed = Math.max(0, ANNUAL_QUEUE_TARGET - before);

  for (const raw of candidates) {
    if (selected.length >= needed) break;
    const question = raw.trim().replace(/\s+/g, " ");
    if (!question || question.length > 500) continue;
    const key = qotdKey(question);
    if (seen.has(key)) continue;
    selected.push(question);
    seen.add(key);
  }

  if (selected.length) {
    await query(
      "INSERT INTO faye_qotd_suggestions " +
      "(guild_id,submitted_by,question,approved,used) " +
      "SELECT $1,$2,t.question,TRUE,FALSE " +
      "FROM unnest($3::text[]) AS t(question)",
      [guildId, "Faye 365-day QOTD collection", selected]
    );
  }
  const after = await query(
    "SELECT COUNT(*) FILTER (WHERE approved)::int AS total, " +
    "COUNT(*) FILTER (WHERE approved AND NOT COALESCE(used,FALSE))::int AS available " +
    "FROM faye_qotd_suggestions WHERE guild_id=$1",
    [guildId]
  );
  return {
    total: Number(after.rows[0]?.total ?? 0),
    added: selected.length,
    available: Number(after.rows[0]?.available ?? 0),
    candidates: candidates.length,
  };
}

async function fillPollQueue(guildId: string, query: (sql: string, values?: unknown[]) => Promise<any>): Promise<Counts> {
  const existing = await query(
    "SELECT question_key FROM faye_poll_entries WHERE guild_id=$1",
    [guildId]
  );
  const approved = await query(
    "SELECT COUNT(*)::int AS count FROM faye_poll_entries " +
    "WHERE guild_id=$1 AND approved=TRUE",
    [guildId]
  );
  const before = Number(approved.rows[0]?.count ?? 0);
  const seen = new Set<string>(
    existing.rows.map((r: { question_key: string }) => r.question_key)
  );
  const needed = Math.max(0, ANNUAL_QUEUE_TARGET - before);
  const selected: Array<{ question: string; question_key: string; answers: string[] }> = [];
  for (const line of YEAR_POLL_CANDIDATES) {
    if (selected.length >= needed) break;
    const poll = parsePoll(line);
    if (seen.has(poll.key)) continue;
    seen.add(poll.key);
    selected.push({ question: poll.question, question_key: poll.key, answers: poll.answers });
  }

  let added = 0;
  if (selected.length) {
    const result = await query(
      "INSERT INTO faye_poll_entries " +
      "(guild_id,submitted_by,question,question_key,answers,approved,used) " +
      "SELECT $1,$2,t.question,t.question_key,t.answers,TRUE,FALSE " +
      "FROM jsonb_to_recordset($3::jsonb) AS t(question text, question_key text, answers jsonb) " +
      "ON CONFLICT (guild_id,question_key) DO NOTHING RETURNING id",
      [guildId, "Faye 365-day poll collection", JSON.stringify(selected)]
    );
    added = result.rowCount ?? 0;
  }
  const after = await query(
    "SELECT COUNT(*) FILTER (WHERE approved)::int AS total, " +
    "COUNT(*) FILTER (WHERE approved AND NOT used)::int AS available " +
    "FROM faye_poll_entries WHERE guild_id=$1",
    [guildId]
  );
  return {
    total: Number(after.rows[0]?.total ?? 0),
    added,
    available: Number(after.rows[0]?.available ?? 0),
    candidates: YEAR_POLL_CANDIDATES.length,
  };
}

/**
 * Fill each approved catalog to 365 including previously used posts.
 *
 * - Never delete or modify staff/member-submitted questions.
 * - Never autoapprove pending member suggestions.
 * - Dedupe against ALL submitted questions, including used and pending.
 * - No new posts are sent and no posting schedule/notification settings change.
 * - An advisory transaction lock prevents duplicate concurrent seeding.
 * - Re-running on Railway restarts only tops up if the catalog drops below 365.
 */
export async function seedAnnualQueues(guildId: string): Promise<void> {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      "SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
      ["Faye annual questions", guildId]
    );
    const query = (sql: string, values?: unknown[]) => connection.query(sql, values);
    const qotd = await fillQotdQueue(guildId, query);
    const polls = await fillPollQueue(guildId, query);
    await connection.query("COMMIT");
    console.log(
      "🌸 Annual QOTD catalog: " + qotd.total + " approved (" + qotd.added +
      " added; " + qotd.available + " unused; " + qotd.candidates + " candidates)"
    );
    console.log(
      "🗳️ Annual poll catalog: " + polls.total + " approved (" + polls.added +
      " added; " + polls.available + " unused; " + polls.candidates + " candidates)"
    );
    if (qotd.total < ANNUAL_QUEUE_TARGET || polls.total < ANNUAL_QUEUE_TARGET) {
      console.warn(
        "⚠️ One catalog is short of 365 approved entries; add more unique candidates."
      );
    }
    if (qotd.total > ANNUAL_QUEUE_TARGET || polls.total > ANNUAL_QUEUE_TARGET) {
      console.log(
        "ℹ️ One catalog already exceeded 365; all existing user entries were retained."
      );
    }
  } catch (error) {
    await connection.query("ROLLBACK").catch(e =>
      console.error("Failed to roll back annual question seeding", e)
    );
    throw error;
  } finally {
    connection.release();
  }
}
