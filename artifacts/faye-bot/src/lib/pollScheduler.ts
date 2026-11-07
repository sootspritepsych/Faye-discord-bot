import cron from "node-cron";
import type { Client } from "discord.js";
import { allPollConfigs, localParts, POLL_TIMEZONE, postPoll } from "./pollService";

async function tick(client: Client, catchUp: boolean): Promise<void> {
  const now = localParts();
  for (const config of await allPollConfigs()) {
    if (!config.channel_id) continue;
    const minutesLate = now.minute - config.post_hour * 60 - config.post_minute;
    if (catchUp ? minutesLate < 0 || minutesLate > 120 : minutesLate !== 0) continue;
    try {
      const result = await postPoll(client, config.guild_id);
      if (result.status === "posted") console.log("🗳️ Poll #" + result.id + " posted");
      else if (!["already_posted", "not_configured"].includes(result.status)) {
        console.warn("Poll skipped for guild " + config.guild_id + ": " + result.status);
      }
    } catch (err) {
      console.error("Poll scheduling failed for guild " + config.guild_id, err);
    }
  }
}

export function startPollScheduler(client: Client): void {
  // Every minute lets admins change the schedule without restarting Faye.
  cron.schedule("* * * * *", () => {
    void tick(client, false).catch(err => console.error("Poll tick failed", err));
  }, { timezone: POLL_TIMEZONE });
  void tick(client, true).catch(err => console.error("Poll startup check failed", err));
  console.log("🗳️ Poll scheduler active; default 10:00 AM America/Chicago");
}
