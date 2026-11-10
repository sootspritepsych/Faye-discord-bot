import { pool } from "./database";

let ready: Promise<void> | undefined;
export function initSocialStore(): Promise<void> {
  if (!ready)
    ready = pool
      .query(
        `
    CREATE TABLE IF NOT EXISTS garden_social_limits (
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL,
      bucket TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id, user_id, kind, bucket)
    );
    CREATE TABLE IF NOT EXISTS garden_social_events (
      id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL, recipient_id TEXT, kind TEXT NOT NULL,
      payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS garden_social_inventory
      ON garden_social_events (guild_id, recipient_id, kind);
    CREATE TABLE IF NOT EXISTS garden_wish_support (
      wish_id TEXT NOT NULL REFERENCES garden_social_events(id),
      user_id TEXT NOT NULL, PRIMARY KEY (wish_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS garden_tea_sessions (
      id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL, sister TEXT NOT NULL, messages JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `,
      )
      .then(() => undefined)
      .catch((error) => {
        ready = undefined;
        throw error;
      });
  return ready;
}

/** Atomic across simultaneous commands and bot replicas. UTC day boundaries. */
export async function claimSocialUse(
  guild: string,
  user: string,
  kind: string,
  max = 1,
  period = 86400,
): Promise<boolean> {
  await initSocialStore();
  const result = await pool.query(
    `
    INSERT INTO garden_social_limits (guild_id,user_id,kind,bucket)
    VALUES ($1,$2,$3,FLOOR(EXTRACT(EPOCH FROM NOW())/$5)::TEXT)
    ON CONFLICT (guild_id,user_id,kind,bucket) DO UPDATE
      SET uses=garden_social_limits.uses+1 WHERE garden_social_limits.uses < $4
    RETURNING uses`,
    [guild, user, kind, max, period],
  );
  return result.rowCount === 1;
}

export async function saveSocialEvent(
  id: string,
  guild: string,
  channel: string,
  user: string,
  kind: string,
  payload: object,
  recipient: string | null = null,
): Promise<void> {
  await initSocialStore();
  await pool.query(
    `INSERT INTO garden_social_events
    (id,guild_id,channel_id,user_id,kind,payload,recipient_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, guild, channel, user, kind, JSON.stringify(payload), recipient],
  );
}
