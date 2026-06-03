import { Client, Events, ActivityType } from "discord.js";
import { loadReminders } from "../lib/reminderScheduler";
import { startWisdomScheduler } from "../lib/wisdomScheduler";
import { startWelcomeJourneyScheduler } from "../lib/welcomeJourneyScheduler";
import { startQotdScheduler } from "../lib/qotdScheduler";

export default function registerReadyEvent(client: Client) {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🌿 Faye is awake! Logged in as ${readyClient.user.tag}`);

    readyClient.user.setPresence({
      activities: [{ name: "over the Garden of Harmony 🌸", type: ActivityType.Watching }],
      status: "online",
    });

    await loadReminders(client);
    await startWisdomScheduler(client);
    await startWelcomeJourneyScheduler(client);
    await startQotdScheduler(client);
    
  });
}
