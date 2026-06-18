import {
  Client,
  Events,
  Interaction,
  ChatInputCommandInteraction,
} from "discord.js";
import { commands } from "../commands";
import {
  handleConfessionReplyButton,
  handleConfessionReplyModal,
} from "./confessionHandlers";
import { handleTicketButton } from "./ticketHandlers";

export default function registerInteractionCreateEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction as ChatInputCommandInteraction);
        return;
      }

      // Buttons
      if (interaction.isButton()) {
        // Confession reply button
        if (interaction.customId.startsWith("confess-reply_")) {
          await handleConfessionReplyButton(interaction);
          return;
        }

        // Ticket buttons
        if (
          interaction.customId === "ticket_open" ||
          interaction.customId === "ticket_close" ||
          interaction.customId === "ticket_claim"
        ) {
          await handleTicketButton(interaction);
          return;
        }
      }

      // Modals
      if (interaction.isModalSubmit()) {
        // Confession reply modal
        if (interaction.customId.startsWith("confess-reply-modal_")) {
          await handleConfessionReplyModal(interaction);
          return;
        }
      }
    } catch (err) {
      console.error("Interaction error:", err);

      const msg = {
        content: "Something stirred the garden unexpectedly. Please try again. 🍃",
        ephemeral: true,
      };

      if (
        interaction.isRepliable() &&
        (interaction.replied || interaction.deferred)
      ) {
        await interaction.followUp(msg).catch(() => {});
      } else if (interaction.isRepliable()) {
        await interaction.reply(msg).catch(() => {});
      }
    }
  });
}