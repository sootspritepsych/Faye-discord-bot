import { Client, Events, Interaction, ChatInputCommandInteraction } from "discord.js";
import { commands } from "../commands";

export default function registerInteractionCreateEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      const msg = { content: "Something stirred the garden unexpectedly. Please try again. 🍃", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  });
}
