import {
  Client,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { commands } from "../commands";
import {
  handleConfessionReplyButton,
  handleConfessionReplyModal,
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
        console.error(
          `Error executing command ${interaction.commandName}:`,
          err
        );

        const msg = {
          content:
            "Something stirred the garden unexpectedly. Please try again. 🍃",
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

      // Ticket Button
      if (interaction.customId === "ticket_open") {
        const guild = interaction.guild;

        if (!guild) return;

        // Prevent duplicate tickets
        const existing = guild.channels.cache.find(
          (channel) =>
            channel.name.startsWith("ticket-") &&
            channel.name.includes(interaction.user.username.toLowerCase())
        );

        if (existing) {
          await interaction.reply({
            content: `🌿 You already have an open ticket: ${existing}`,
            ephemeral: true,
          });
          return;
        }

        // Find the staff role
        const staffRole =
          guild.roles.cache.find((r) =>
            r.permissions.has(PermissionFlagsBits.ManageMessages)
          ) ?? guild.roles.cache.find((r) => r.name.toLowerCase().includes("staff"));

        // Create ticket channel
        const ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username.toLowerCase()}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ["ViewChannel"],
            },
            {
              id: interaction.user.id,
              allow: [
                "ViewChannel",
                "SendMessages",
                "ReadMessageHistory",
              ],
            },
            ...(staffRole
              ? [
                  {
                    id: staffRole.id,
                    allow: [
                      "ViewChannel",
                      "SendMessages",
                      "ReadMessageHistory",
                    ],
                  },
                ]
              : []),
          ],
        });

        await ticketChannel.send({
          content:
            `🌿 Welcome ${interaction.user}!\n\n` +
            "Please explain what you need help with. A member of the Garden team will assist you shortly.",
        });

        await interaction.reply({
          content: `🌸 Your ticket has been created: ${ticketChannel}`,
          ephemeral: true,
        });

        return;
      }

      return;
    }

    // Confession Modal
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("confess-reply-modal_")) {
        await handleConfessionReplyModal(interaction);
      }
    }
  });
}