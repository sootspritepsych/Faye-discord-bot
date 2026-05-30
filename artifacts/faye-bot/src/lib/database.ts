import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export const stickyMessages = pgTable("faye_sticky_messages", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  content: text("content").notNull(),
  lastMessageId: text("last_message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reminders = pgTable("faye_reminders", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  message: text("message").notNull(),
  cronExpression: text("cron_expression").notNull(),
  tagRoleId: text("tag_role_id"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const confessions = pgTable("faye_confessions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  content: text("content").notNull(),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suggestions = pgTable("faye_suggestions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  content: text("content").notNull(),
  messageId: text("message_id"),
  yesVotes: integer("yes_votes").default(0),
  noVotes: integer("no_votes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qotdSuggestions = pgTable("faye_qotd_suggestions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  submittedBy: text("submitted_by").notNull(),
  question: text("question").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guildConfig = pgTable("faye_guild_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  confessionsChannelId: text("confessions_channel_id"),
  suggestionsChannelId: text("suggestions_channel_id"),
  qotdModChannelId: text("qotd_mod_channel_id"),
  welcomeChannelId: text("welcome_channel_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faye_guild_config (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL UNIQUE,
      confessions_channel_id TEXT,
      suggestions_channel_id TEXT,
      qotd_mod_channel_id TEXT,
      welcome_channel_id TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_sticky_messages (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      last_message_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_reminders (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      tag_role_id TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_confessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_suggestions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_id TEXT,
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_qotd_suggestions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      question TEXT NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("🌿 Faye database tables initialized");
}
