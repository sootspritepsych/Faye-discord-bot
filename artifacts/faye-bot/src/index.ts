import { Client, GatewayIntentBits, Partials } from "discord.js";
import { initDb } from "./lib/database";
import registerReadyEvent from "./events/ready";
import registerGuildMemberAddEvent from "./events/guildMemberAdd";
import registerMessageCreateEvent from "./events/messageCreate";
import registerInteractionCreateEvent from "./events/interactionCreate";
import registerVoiceStateUpdateEvent from "./events/voiceStateUpdate";
import registerGardenReactionEvent from "./events/messageReactionAdd";
import registerGardenPollVoteEvent from "./events/gardenPollVote";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN environment variable");
  process.exit(1);
} 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

async function main() {
  await initDb();

  registerReadyEvent(client);
  registerGuildMemberAddEvent(client);
  registerMessageCreateEvent(client);
  registerInteractionCreateEvent(client);
  registerVoiceStateUpdateEvent(client);
  registerGardenReactionEvent(client);
  registerGardenPollVoteEvent(client);

  await client.login(token);
}

main().catch((err) => {
  console.error("Fatal error starting Faye:", err);
  process.exit(1);
});
