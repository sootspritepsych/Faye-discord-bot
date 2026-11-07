import { pool } from "./lib/database";
import { importPolls } from "./lib/pollService";
import { SEED_POLLS } from "./commands/poll";

async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faye_poll_config (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      post_hour INTEGER NOT NULL DEFAULT 10 CHECK (post_hour BETWEEN 0 AND 23),
      post_minute INTEGER NOT NULL DEFAULT 0 CHECK (post_minute BETWEEN 0 AND 59)
    );
    ALTER TABLE faye_poll_config ADD COLUMN IF NOT EXISTS potd_role_id TEXT;
    CREATE TABLE IF NOT EXISTS faye_poll_entries (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      question TEXT NOT NULL,
      question_key TEXT NOT NULL,
      answers JSONB NOT NULL,
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (guild_id, question_key)
    );
    CREATE TABLE IF NOT EXISTS faye_daily_poll_posts (
      guild_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      poll_id INTEGER NOT NULL UNIQUE REFERENCES faye_poll_entries(id),
      message_id TEXT,
      PRIMARY KEY (guild_id, local_date)
    );
    CREATE INDEX IF NOT EXISTS faye_poll_unused_idx
      ON faye_poll_entries (guild_id, approved, used);
  `);
  // Garden of Harmony's existing private testing channel.
  // Preserve any later channel chosen by staff: never overwrite existing config.
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId) {
    await pool.query(
      "INSERT INTO faye_poll_config (guild_id,channel_id) VALUES ($1,$2) " +
      "ON CONFLICT (guild_id) DO NOTHING",
      [guildId, "1568435643581730917"]
    );
    // Safe and idempotent across redeployments; previously used polls are never re-added.
    const result = await importPolls(guildId, "Faye starter polls", SEED_POLLS, true);
    console.log("🗳️ Starter polls: " + result.added + " added, " + result.duplicates + " duplicates skipped");
  } else {
    console.warn("⚠️ DISCORD_GUILD_ID missing; configure poll channel and queue in Discord");
  }
  console.log("🗳️ Faye polling database migration complete");
}
main().then(() => process.exit(0)).catch(err => {
  console.error("Poll migration failed:", err);
  process.exit(1);
});
