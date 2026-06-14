import { REST, Routes } from "discord.js";
import { commandsArray } from "./commands";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function deployCommands() {
  console.log("🌿 Registering slash commands...");

  try {
    if (guildId) {
      // Guild-specific (instant, for testing)
      await rest.put(Routes.applicationCommands(clientId!), {
        body: [],
  });
      console.log(`✅ Registered ${commandsArray.length} commands to guild ${guildId}`);
    } else {
      // Global (takes up to 1 hour to propagate)
await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
  body: commandsArray,
});
      console.log(`✅ Registered ${commandsArray.length} commands globally`);
    }
  } catch (err) {
    console.error("Error registering commands:", err);
    process.exit(1);
  }
}

deployCommands();
