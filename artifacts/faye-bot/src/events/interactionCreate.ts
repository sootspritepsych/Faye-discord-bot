import { Client, Events, Interaction, ChatInputCommandInteraction } from "discord.js";
import { commands } from "../commands";
import { handleConfessionReplyButton, handleConfessionReplyModal } from "./confessionHandlers";

export default function registerInteractionCreateEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
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
      return;
    }

    // Button: confession reply
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("confess-reply_")) {
        await handleConfessionReplyButton(interaction);
      }
      return;
    }

    // Modal: confession reply submission
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("confess-reply-modal_")) {
        await handleConfessionReplyModal(interaction);
      }
    }
  });
}
