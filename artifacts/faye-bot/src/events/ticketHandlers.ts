import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, tickets } from "../lib/database";

const FAYE_GUIDE_ROLE_ID = "1351498500742971447";
const TICKET_CATEGORY_ID = "1517072801062850560";

export async function handleTicketButton(interaction: ButtonInteraction) {
  if (interaction.customId === "ticket_open") {
    await openTicket(interaction);
    return true;
  }

  if (interaction.customId === "ticket_claim") {
    await claimTicket(interaction);
    return true;
  }

  if (interaction.customId === "ticket_close") {
    await closeTicket(interaction);
    return true;
  }

  if (interaction.customId === "ticket_delete") {
    await deleteTicket(interaction);
    return true;
  }

  return false;
}

async function openTicket(interaction: ButtonInteraction) {
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
    guild.roles.cache.get(FAYE_GUIDE_ROLE_ID) ??
    guild.roles.cache.find((r) =>
      r.permissions.has(PermissionFlagsBits.ManageMessages)
    );

  const ticketCount =
    guild.channels.cache.filter((channel) =>
      channel.name.startsWith("ticket-")
    ).size + 1;

  const ticketNumber = String(ticketCount).padStart(3, "0");

  const ticketChannel = await guild.channels.create({
    name: `ticket-${ticketNumber}-${safeUsername}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      ...(staffRole
        ? [
            {
              id: staffRole.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ]
        : []),
    ],
  });

  await db.insert(tickets).values({
    guildId: guild.id,
    channelId: ticketChannel.id,
    userId: interaction.user.id,
    username: interaction.user.username,
    status: "open",
  });

  await ticketChannel.send({
    content:
      `🌿 Welcome ${interaction.user}!\n\n` +
      "Please explain what you need help with.\n\n" +
      `A <@&${FAYE_GUIDE_ROLE_ID}> will be with you shortly. 🍃`,
    allowedMentions: {
      roles: [FAYE_GUIDE_ROLE_ID],
    },
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim")
          .setStyle(ButtonStyle.Success).setEmoji("🍃"),
        new ButtonBuilder().setCustomId("ticket_close").setLabel("Close")
          .setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
        new ButtonBuilder().setCustomId("ticket_delete").setLabel("Delete")
          .setStyle(ButtonStyle.Danger).setEmoji("🗑️")
      ),
    ],
  });

  await interaction.reply({
    content: `🌸 Your ticket has been created: ${ticketChannel}`,
    ephemeral: true,
  });
}

async function claimTicket(interaction: ButtonInteraction) {
  await db
    .update(tickets)
    .set({ claimedBy: interaction.user.id })
    .where(eq(tickets.channelId, interaction.channelId));

  await interaction.reply({
    content: `🍃 Ticket claimed by ${interaction.user}.`,
  });
}

async function closeTicket(interaction: ButtonInteraction) {
  await db
    .update(tickets)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(eq(tickets.channelId, interaction.channelId));

  await interaction.reply({
    content: "🔒 This ticket has been closed.",
  });
}

async function deleteTicket(interaction: ButtonInteraction) {
  await interaction.reply({
    content: "🗑️ Deleting this ticket in 5 seconds...",
  });

  setTimeout(async () => {
    await interaction.channel?.delete().catch(console.error);
  }, 5000);
}