import { drizzle } from "drizzle-orm/node-postgres";
import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

export const db = drizzle(pool);

export const stickyMessages = pgTable("faye_sticky_messages", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  content: text("content").notNull(),
  lastMessageId: text("last_message_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voiceSessions = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id").notNull(),
  joinedAt: timestamp("joined_at").notNull(),
  leftAt: timestamp("left_at"),
  durationSeconds: integer("duration_seconds"),
});

export const reminders = pgTable("faye_reminders", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  message: text("message").notNull(),
  cronExpression: text("cron_expression").notNull(),
  tagRoleId: text("tag_role_id"),
  eventName: text("event_name"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const confessions = pgTable("faye_confessions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  category: text("category").default("Random"),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const confessionReplies = pgTable("faye_confession_replies", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  confessionId: integer("confession_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suggestions = pgTable("faye_suggestions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
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

export const warnings = pgTable("faye_warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorUsername: text("moderator_username").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const wisdomQuotes = pgTable("faye_wisdom", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  content: text("content").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const welcomeJourneys = pgTable("faye_welcome_journeys", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  joinTime: timestamp("join_time").notNull().defaultNow(),
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
});

export const guildConfig = pgTable("faye_guild_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),

  staffRoleId: text("staff_role_id"),
  announcementChannelId: text("announcement_channel_id"),

  confessionsChannelId: text("confessions_channel_id"),
  suggestionsChannelId: text("suggestions_channel_id"),
  qotdModChannelId: text("qotd_mod_channel_id"),
  qotdPostChannelId: text("qotd_post_channel_id"),
  qotdPostHour: integer("qotd_post_hour").default(9),
  welcomeChannelId: text("welcome_channel_id"),
  wisdomChannelId: text("wisdom_channel_id"),
  wisdomPostHour: integer("wisdom_post_hour").default(8),
  wisdomPingRoleId: text("wisdom_ping_role_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationHistory = pgTable("conversation_history", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userMemories = pgTable("faye_user_memories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  memory: text("memory").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const natureFacts = pgTable("nature_facts", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  fact: text("fact").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const titleReservations = pgTable("title_reservations", {
  id: serial("id").primaryKey(),

  eventId: integer("event_id"),
  guildId: text("guild_id").notNull(),
  discordUserId: text("discord_user_id").notNull(),

  server: text("server").notNull(),
  ign: text("ign").notNull(),
  coordinates: text("coordinates").notNull(),

  title: text("title").notNull(),
  date: text("date").notNull(),
  hourUtc: integer("hour_utc").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),

  guildId: text("guild_id").notNull(),

  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),

  server: text("server"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),

  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username"),
  status: text("status").default("open").notNull(),
  claimedBy: text("claimed_by"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      joined_at TIMESTAMP NOT NULL,
      left_at TIMESTAMP,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS faye_guild_config (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL UNIQUE,
      staff_role_id TEXT,
      announcement_channel_id TEXT,
      confessions_channel_id TEXT,
      suggestions_channel_id TEXT,
      qotd_mod_channel_id TEXT,
      qotd_post_channel_id TEXT,
      qotd_post_hour INTEGER DEFAULT 9,
      welcome_channel_id TEXT,
      wisdom_channel_id TEXT,
      wisdom_post_hour INTEGER DEFAULT 8,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_sticky_messages (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      last_message_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_reminders (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      tag_role_id TEXT,
      event_name TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_confessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'unknown',
      username TEXT NOT NULL DEFAULT 'unknown',
      content TEXT NOT NULL,
      category TEXT DEFAULT 'Random',
      message_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_confession_replies (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      confession_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      message_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_suggestions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'unknown',
      username TEXT NOT NULL DEFAULT 'unknown',
      content TEXT NOT NULL,
      message_id TEXT,
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_warnings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_username TEXT NOT NULL,
      reason TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS faye_wisdom (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      content TEXT NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS faye_welcome_journeys (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      join_time TIMESTAMP NOT NULL DEFAULT NOW(),
      sent BOOLEAN DEFAULT FALSE,
      sent_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faye_user_memories (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      memory TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversation_history (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nature_facts (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      fact TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS title_reservations (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      server TEXT NOT NULL,
      ign TEXT NOT NULL,
      coordinates TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      hour_utc INTEGER NOT NULL,
      calendar_event_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

    ALTER TABLE faye_confessions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE faye_confessions ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE faye_confessions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Random';

    ALTER TABLE faye_suggestions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE faye_suggestions ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'unknown';

    ALTER TABLE faye_reminders ADD COLUMN IF NOT EXISTS event_name TEXT;

    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS qotd_post_channel_id TEXT;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS qotd_post_hour INTEGER DEFAULT 9;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS wisdom_channel_id TEXT;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS wisdom_post_hour INTEGER DEFAULT 8;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS wisdom_ping_role_id TEXT;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS staff_role_id TEXT;
    ALTER TABLE faye_guild_config ADD COLUMN IF NOT EXISTS announcement_channel_id TEXT;
    
    ALTER TABLE faye_sticky_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  console.log("🌿 Faye database tables initialized");
}
