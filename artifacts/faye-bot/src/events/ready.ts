import { Client, Events } from "discord.js";
import { loadReminders } from "../lib/reminderScheduler";
import { startWisdomScheduler } from "../lib/wisdomScheduler";
import { startWelcomeJourneyScheduler } from "../lib/welcomeJourneyScheduler";
import { startFayeMoodRotation } from "../lib/fayeMoodService";
import { startQotdScheduler } from "../lib/qotdScheduler";
import { startPollScheduler } from "../lib/pollScheduler";
import { initializePotdRoles, backfillExistingQotdMembers } from "../lib/potdRoleService";

export default function registerReadyEvent(client: Client): void {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🌿 Faye is awake! Logged in as ${readyClient.user.tag}`);

    startFayeMoodRotation(client);
    startQotdScheduler(client);

    try {
      await initializePotdRoles(client);
      // Run the potentially lengthy migration without delaying other schedulers.
      void backfillExistingQotdMembers(client).catch(error =>
        console.error("❌ POTD member backfill failed:", error)
      );
      startPollScheduler(client);
      await loadReminders(client);
      await startWisdomScheduler(client);
      await startWelcomeJourneyScheduler(client);
      console.log("🌿 Faye's Garden systems are ready.");
    } catch (error) {
      console.error("❌ Failed to initialize one or more Faye systems:", error);
    }
  });
}
