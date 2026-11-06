import { sql } from "drizzle-orm";
import { db } from "./lib/database";

async function migrateQotd() {
  console.log("🌸 Starting QOTD database migration...");

  // Add approval tracking to existing questions.
  await db.execute(sql`
    ALTER TABLE "faye_qotd_suggestions"
    ADD COLUMN IF NOT EXISTS "approved"
    BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  console.log("✅ QOTD approval column ready.");

  // Create daily posting history.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qotd_daily_posts" (
      "guild_id" TEXT NOT NULL,
      "local_date" TEXT NOT NULL,
      "question_id" INTEGER NOT NULL,
      "message_id" TEXT,

      PRIMARY KEY ("guild_id", "local_date")
    );
  `);

  console.log("✅ Daily QOTD tracking table ready.");
  console.log("🌿 QOTD database migration complete!");
}

migrateQotd()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ QOTD migration failed:", error);
    process.exit(1);
  });
