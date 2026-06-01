import cron from "node-cron";
import { Client } from "discord.js";
import { db, welcomeJourneys } from "./database";
import { eq, and, lt } from "drizzle-orm";

const FOLLOW_UP_MESSAGE = (username: string) =>
  `🌱 Hello again, **${username}**!\n\n` +
  `It's been a day since you joined **Garden of Harmony**. Sprout wanted to check in and see how you're settling in. 🌿\n\n` +
  `If you haven't had a chance yet, feel free to:\n` +
  `🌸 Introduce yourself to the community\n` +
  `🎀 Grab some roles to personalize your experience\n` +
  `💬 Jump into a conversation — everyone here is friendly!\n\n` +
  `The garden is always here for you. May your path continue to bloom.\n\n` +
  `— Faye ✨`;

export async function startWelcomeJourneyScheduler(client: Client) {
  // Check every hour for pending 24h follow-ups
  cron.schedule("30 * * * *", async () => {
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const pending = await db
        .select()
        .from(welcomeJourneys)
        .where(and(eq(welcomeJourneys.sent, false), lt(welcomeJourneys.joinTime, cutoff)));

      for (const journey of pending) {
        try {
          const user = await client.users.fetch(journey.userId);
          await user.send(FOLLOW_UP_MESSAGE(user.username));
          await db
            .update(welcomeJourneys)
            .set({ sent: true, sentAt: new Date() })
            .where(eq(welcomeJourneys.id, journey.id));
        } catch {
          // DMs closed or user not found — mark as sent anyway so we don't retry forever
          await db
            .update(welcomeJourneys)
            .set({ sent: true, sentAt: new Date() })
            .where(eq(welcomeJourneys.id, journey.id));
        }
      }

      if (pending.length > 0) {
        console.log(`🌱 Sent ${pending.length} welcome journey follow-ups`);
      }
    } catch (err) {
      console.error("Error running welcome journey scheduler:", err);
    }
  });

  console.log("🌱 Welcome journey scheduler started");
}
