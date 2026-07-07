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
import { db, wisdomQuotes } from "../lib/database";

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
        // Bulk wisdom quote import
        if (interaction.customId === "addwquotes_modal") {
          const rawQuotes = interaction.fields.getTextInputValue("quotes");

          const quotes = rawQuotes
            .split("\n")
            .map((q) => q.trim())
            .filter((q) => q.length > 0);

          if (quotes.length === 0) {
            await interaction.reply({
              content: "No quotes were found.",
              ephemeral: true,
            });
            return;
          }

          // Remove duplicates from the pasted list
          const uniqueQuotes = [...new Set(quotes)];

          // Optional: Skip quotes already in the database
          const existing = await db.select().from(wisdomQuotes);

          const existingQuotes = new Set(
            existing.map((q) => q.quote.trim().toLowerCase())
          );

          const newQuotes = uniqueQuotes.filter(
            (q) => !existingQuotes.has(q.trim().toLowerCase())
          );

          if (newQuotes.length > 0) {
            await db.insert(wisdomQuotes).values(
              newQuotes.map((quote) => ({
                quote,
              }))
            );
          }

          await interaction.reply({
            content:
              `🍃 **Wisdom Quote Import Complete**\n\n` +
              `✅ Added: **${newQuotes.length}**\n` +
              `⏭️ Skipped duplicates: **${uniqueQuotes.length - newQuotes.length}**`,
            ephemeral: true,
          });

          return;
        }

        // Confession reply modal
        if (interaction.customId.startsWith("confess-reply-modal_")) {
          await handleConfessionReplyModal(interaction);
          return;
        }
      }
    } catch (err) {
      console.error("Interaction error:", err);

      const msg = {
        content:
          "Something stirred the garden unexpectedly. Please try again. 🍃",
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
