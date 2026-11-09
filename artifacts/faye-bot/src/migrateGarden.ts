import { pool } from "./lib/database";

/**
 * Garden data is separate from chat XP, casino currency and Faye rapport.
 * Safe to run on every Railway deployment.
 */
async function migrateGarden(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faye_garden_settings (
      guild_id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      tree_name TEXT NOT NULL DEFAULT 'Harmony Tree',
      announcement_channel_id TEXT
    );

    -- Existing deployments already have faye_garden_settings. Upgrade in-place.
    ALTER TABLE faye_garden_settings
      ADD COLUMN IF NOT EXISTS announcement_channel_id TEXT;

    CREATE TABLE IF NOT EXISTS faye_garden_activity (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('chat', 'reaction', 'plant', 'water', 'harvest', 'ornament')),
      source_id TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1 CHECK (points BETWEEN 0 AND 20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (guild_id, source_id)
    );

    CREATE INDEX IF NOT EXISTS faye_garden_activity_period_idx
      ON faye_garden_activity (guild_id, created_at DESC, kind);
    CREATE INDEX IF NOT EXISTS faye_garden_activity_user_idx
      ON faye_garden_activity (guild_id, user_id, created_at DESC, kind);

    CREATE TABLE IF NOT EXISTS faye_garden_plants (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      species TEXT NOT NULL CHECK (species IN ('sunflower','tulip','rose','lavender','tomato','carrot','pumpkin','fern')),
      water_count INTEGER NOT NULL DEFAULT 0,
      planted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      harvested_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS faye_garden_plants_guild_idx
      ON faye_garden_plants (guild_id, planted_at DESC);

    CREATE TABLE IF NOT EXISTS faye_garden_waterings (
      guild_id TEXT NOT NULL,
      plant_id BIGINT NOT NULL REFERENCES faye_garden_plants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, plant_id, user_id, local_date)
    );

    CREATE TABLE IF NOT EXISTS faye_garden_ornaments (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      decoration TEXT NOT NULL CHECK (decoration IN ('star','red_bauble','gold_bauble','snowflake','ribbon','lights')),
      season INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (guild_id, user_id, decoration, season)
    );

    CREATE INDEX IF NOT EXISTS faye_garden_ornaments_guild_idx
      ON faye_garden_ornaments (guild_id, season);
  `);
  console.log("🌳 Community Garden database ready (disabled until /garden enable).");
}

migrateGarden()
  .then(() => process.exit(0))
  .catch((error) => { console.error("Garden migration failed:", error); process.exit(1); });
