import { startGuardianConfessions } from "../lib/guardianConfessionScheduler";
import { Client, Events } from "discord.js";
import { loadReminders } from "../lib/reminderScheduler";
import { startWisdomScheduler } from "../lib/wisdomScheduler";
import { startWelcomeJourneyScheduler } from "../lib/welcomeJourneyScheduler";
import { startFayeMoodRotation } from "../lib/fayeMoodService";
import { startQotdScheduler } from "../lib/qotdScheduler";
import { startGardenAwards } from "../lib/gardenAwardScheduler";
import { startGardenMilestones } from "../lib/gardenMilestoneScheduler";
import { startPollScheduler } from "../lib/pollScheduler";
import { initializePotdRoles } from "../lib/potdRoleService";
import { backfillPotdForQotdMembers } from "../lib/potdBackfill";
import { startFoodScheduler } from "../lib/foodScheduler";

export default function registerReadyEvent(client: Client): void {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🌿 Faye is awake! Logged in as ${readyClient.user.tag}`);

    startFayeMoodRotation(client);
    startGuardianConfessions(client);
    startQotdScheduler(client);
    startGardenAwards(client);
    startGardenMilestones(client);
    void startFoodScheduler(client).catch(error => console.error("📷 Food scheduler initialization failed", error));

    try {
      await initializePotdRoles(client);
      startPollScheduler(client);
      // One-time role backfill can take minutes in a large server. Do not block Faye startup.
      void backfillPotdForQotdMembers(client).catch(error =>
        console.error("❌ POTD backfill initialization failed", error)
      );
      await loadReminders(client);
      await startWisdomScheduler(client);
      await startWelcomeJourneyScheduler(client);
      console.log("🌿 Faye's Garden systems are ready.");
    } catch (error) {
      console.error("❌ Failed to initialize one or more Faye systems:", error);
    }
  });
}

