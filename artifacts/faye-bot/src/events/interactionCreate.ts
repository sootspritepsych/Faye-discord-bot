import {
  Client,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { eq } from "drizzle-orm";
import { commands } from "../commands";
import { db, tickets } from "../lib/database";
import {
  handleConfessionReplyButton,
  handleConfessionReplyModal,
import { handleTicketButton } from "./ticketHandlers";
} from "./confessionHandlers";

export default function registerInteractionCreateEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction as ChatInputCommandInteraction);
      } catch (err) {
        console.error(`Error executing command ${interaction.commandName}:`, err);

        const msg = {
          content: "Something stirred the garden unexpectedly. Please try again. 🍃",
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      }

      return;
    }

    // Buttons
    if (interaction.isButton()) {
      // Confession Reply
      if (interaction.customId.startsWith("confess-reply_")) {
        await handleConfessionReplyButton(interaction);
        return;
      }

      // Ticket Open
      if (interaction.customId === "ticket_open") {
        const guild = interaction.guild;
        if (!guild) return;

        const safeUsername = interaction.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const existing = guild.channels.cache.find(
          (channel) =>
            channel.name.starts