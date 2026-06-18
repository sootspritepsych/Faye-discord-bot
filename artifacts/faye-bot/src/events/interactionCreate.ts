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
            channel.name.startsWith("ticket-") &&
            channel.name.includes(safeUsername)
        );

        if (existing) {
          await interaction.reply({
            content: `🌿 You already have an open ticket: ${existing}`,
            ephemeral: true,
          });
          return;
        }

        const staffRole =
          guild.roles.cache.get("1351498500742971447") ??
          guild.roles.cache.find((r) =>
            r.permissions.has(PermissionFlagsBits.ManageMessages)
          ) ??
          guild.roles.cache.find((r) =>
            r.name.toLowerCase().includes("staff")
          );

        const ticketCount =
          guild.channels.cache.filter((channel) =>
            channel.name.startsWith("ticket-")
          ).size + 1;

        const ticketNumber = String(ticketCount).padStart(3, "0");

        const ticketChannel = await guild.channels.create({
          name: `ticket-${ticketNumber}-${safeUsername}`,
          parent: "1517072801062850560",
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ["ViewChannel"],
            },
            {
              id: interaction.user.id,
              allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
            },
            ...(staffRole
              ? [
                  {
                    id: staffRole.id,
                    allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
                  },
                ]
              : []),
          ],
        });

        await ticketChannel.send({
          content:
            `🌿 Welcome ${interaction.user}!\n\n` +
            "Please explain what you need help with.\n\n" +
            "A <@&1351498500742971447> will be with you shortly. 🍃",
          allowedMentions: {
            roles: ["1351498500742971447"],
          },
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  custom_id: "ticket_claim",
                  label: "Claim",
                  style: 3,
                  emoji: "🍃",
                },
                {
                  type: 2,
                  custom_id: "ticket_close",
                  label: "Close",
                  style: 2,
                  emoji: "🔒",
                },
                {
                  type: 2,
                  custom_id: "ticket_delete",
                  label: "Delete",
                  style: 4,
                  emoji: "🗑️",
                },
              ],
            },
          ],
        });

        await interaction.reply({
          content: `🌸 Your ticket has been created: ${ticketChannel}`,
          ephemeral: true,
        });

        return;
      }

      // Ticket Claim
      if (interaction.customId === "ticket_claim") {
        await interaction.reply({
          content: `🍃 Ticket claimed by ${interaction.user}.`,
        });
        return;
      }

      // Ticket Close
      if (interaction.customId === "ticket_close") {
        await interaction.reply({
          content: "🔒 This ticket has been closed.",
        });
        return;
      }

      // Ticket Delete
      if (interaction.customId === "ticket_delete") {
        await interaction.reply({
          content: "🗑️ Deleting this ticket in 5 seconds...",
        });

        setTimeout(async () => {
          await interaction.channel?.delete().catch(console.error);
        }, 5000);

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