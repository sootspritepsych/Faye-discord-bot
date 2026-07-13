import {
  Client,
  Events,
} from "discord.js";

import {
  loadReminders,
} from "../lib/reminderScheduler";

import {
  startWisdomScheduler,
} from "../lib/wisdomScheduler";

import {
  startWelcomeJourneyScheduler,
} from "../lib/welcomeJourneyScheduler";

import {
  startFayeMoodRotation,
} from "../lib/fayeMoodService";

export default function registerReadyEvent(
  client: Client
): void {
  client.once(
    Events.ClientReady,
    async (readyClient) => {
      console.log(
        `🌿 Faye is awake! Logged in as ${readyClient.user.tag}`
      );

      // Select a mood immediately and then
      // rotate Faye's presence every 20 minutes.
      startFayeMoodRotation(client);

      try {
        await loadReminders(client);

        await startWisdomScheduler(
          client
        );

        await startWelcomeJourneyScheduler(
          client
        );

        console.log(
          "🌿 Faye's Garden systems are ready."
        );
      } catch (error) {
        console.error(
          "❌ Failed to initialize one or more Faye systems:",
          error
        );
      }
    }
  );
}
