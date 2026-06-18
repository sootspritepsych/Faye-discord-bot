import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { db, tickets } from "./database";

export const FAYE_GUIDE_ROLE_ID = "1351498500742971447";
export const TICKET_CATEGORY_ID = "1517072801062850560";

export async function createTicket(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return null;

  const safeUsername = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const existing = guild.channels.cache.find(
    (c: any) =>
      c.name.startsWith("ticket-") &&
      c.name.includes(safeUsername)
  );

  if (existing) {
    await interaction.reply({
      content: `🌿 You already have an open ticket: ${existing}`,
      ephemeral: true,
    });

    return null;
  }

  const staffRole =
    guild.roles.cache.get(FAYE_GUIDE_ROLE_ID) ??
    guild.roles.cache.find((r: any) =>
      r.permissions.has(PermissionFlagsBits.ManageMessages)
    );

  const nextNumber =
    guild.channels.cache.filter((c: any) =>
      c.name.startsWith("ticket-")
    ).size + 1;

  const number = String(nextNumber).padStart(4, "0");

  const channel = await guild.channels.create({
    name: `ticket-${number}-${safeUsername}`,
    parent: TICKET_CATEGORY_ID,
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

  await db.insert(tickets).values({
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    username: interaction.user.username,
    status: "open",
  });

  const buttons =
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setEmoji("🍃")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setEmoji("🔒")
        .setLabel("Close")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("ticket_delete")
        .setEmoji("🗑️")
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
    );

  await (channel as TextChannel).send({
    content:
      `# 🌿 Garden Support Ticket\n\n` +
      `Welcome ${interaction.user}!\n\n` +
      `A <@&${FAYE_GUIDE_ROLE_ID}> will be with you shortly.\n\n` +
      `Please explain your issue in as much detail as possible.\n\n` +
      `**Ticket:** #${number}`,
    allowedMentions: {
      roles: [FAYE_GUIDE_ROLE_ID],
    },
    components: [buttons],
  });

  await interaction.reply({
    content: `🌸 Your ticket has been created: ${channel}`,
    ephemeral: true,
  });

  return channel;
}