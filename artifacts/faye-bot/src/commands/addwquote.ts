import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("addwquotes")
  .setDescription("Bulk add wisdom quotes to Faye.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("addwquotes_modal")
    .setTitle("Add Wisdom Quotes");

  const quotesInput = new TextInputBuilder()
    .setCustomId("quotes")
    .setLabel("Paste quotes, one per line")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder("You are allowed to rest.\nSmall steps still count.\nYour feelings are real.");

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(quotesInput);

  modal.addComponents(row);

  await interaction.showModal(modal);
}
