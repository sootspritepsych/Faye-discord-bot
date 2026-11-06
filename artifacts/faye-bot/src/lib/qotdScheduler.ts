import cron from "node-cron";
import type { Client } from "discord.js";
import { isNotNull } from "drizzle-orm";
import { db, guildConfig } from "./database";
import { postQotd, QOTD_TIMEZONE } from "./qotdService";

async function runDailyQotd(client: Client): Promise<void> {
  const guilds = await db
    .select({ guildId: guildConfig.guildId })
    .from(guildConfig)
    .where(isNotNull(guildConfig.qotdPostChannelId));

  for (const { guildId } of guilds) {
    try {
      const result = await postQotd(client, guildId);
      if (result.status === "posted") {
        console.log(
          `🌸 Posted QOTD #${result.questionId} in <#${result.channelId}>`
        );
      } else if (result.status === "no_questions") {
        console.warn(`⚠️ No approved, unused QOTDs for guild ${guildId}`);
      } else if (result.status !== "already_posted") {
        console.warn(`⚠️ QOTD skipped for guild ${guildId}: ${result.status}`);
      }
    } catch (error) {
      console.error(`❌ QOTD failed for guild ${guildId}:`, error);
    }
  }
}

function isAfternoonInChicago(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: QOTD_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value);

  // If Faye restarts between 2 PM and 8 PM, catch up on today's QOTD.
  return hour >= 14 && hour < 20;
}

function safeRunDailyQotd(client: Client): void {
  void runDailyQotd(client).catch((error) => {
    console.error("❌ Could not load QOTD guild configuration:", error);
  });
}

export function startQotdScheduler(client: Client): void {
  cron.schedule(
    "0 14 * * *",
    () => { safeRunDailyQotd(client); },
    { timezone: QOTD_TIMEZONE }
  );

  // A same-day catch-up after a restart. The database prevents duplicates.
  if (isAfternoonInChicago()) {
    safeRunDailyQotd(client);
  }

  console.log("🌸 Daily QOTD scheduler active: 2:00 PM America/Chicago");
}
