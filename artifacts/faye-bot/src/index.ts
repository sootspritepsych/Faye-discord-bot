import { Client, GatewayIntentBits, Partials } from "discord.js";
import { initDb } from "./lib/database";
import registerReadyEvent from "./events/ready";
import registerGuildMemberAddEvent from "./events/guildMemberAdd";
import registerMessageCreateEvent from "./events/messageCreate";
import registerInteractionCreateEvent from "./events/interactionCreate";

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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message],
});

async function main() {
  await initDb();

  registerReadyEvent(client);
  registerGuildMemberAddEvent(client);
  registerMessageCreateEvent(client);
  registerInteractionCreateEvent(client);

  await client.login(token);
}

main().catch((err) => {
  console.error("Fatal error starting Faye:", err);
  process.exit(1);
});
