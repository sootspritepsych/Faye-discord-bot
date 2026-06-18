import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Create the Faye ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.channel as TextChannel;

  const embed = new EmbedBuilder()
    .setTitle("Ticket System")
    .setDescription(
      "**SUPPORT CENTER**\n\n" +
        `How can we help? Welcome to our Ticket Channel! If you have any questions, need assistance, or want to reach out to the staff team, simply click the "Open Ticket" button below.\n\n` +
        "We're here to help! Thank you for being part of the Garden of Harmony!"
    )
    .setColor(0x77e6d0);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_open")
      .setLabel("Open Ticket")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });

  await interaction.reply({
    content: "🌿 Ticket panel created.",
    ephemeral: true,
  });
}