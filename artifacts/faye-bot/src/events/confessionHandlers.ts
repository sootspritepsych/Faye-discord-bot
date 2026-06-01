import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db, confessions, confessionReplies, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";

export async function handleConfessionReplyButton(interaction: ButtonInteraction) {
  const confessionId = parseInt(interaction.customId.replace("confess-reply_", ""), 10);

  const modal = new ModalBuilder()
    .setCustomId(`confess-reply-modal_${confessionId}`)
    .setTitle(`Reply to Confession #${confessionId}`);

  const input = new TextInputBuilder()
    .setCustomId("reply-content")
    .setLabel("Your anonymous reply")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(800)
    .setRequired(true)
    .setPlaceholder("Write your anonymous reply here...");

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleConfessionReplyModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const confessionId = parseInt(interaction.customId.replace("confess-reply-modal_", ""), 10);
  const content = interaction.fields.getTextInputValue("reply-content").trim();

  if (!interaction.guildId) {
    await interaction.editReply("This can only be used in a server.");
    return;
  }

  const [config] = await db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, interaction.guildId));

  if (!config?.confessionsChannelId) {
    await interaction.editReply("Confessions channel is not configured.");
    return;
  }

  const [original] = await db
    .select()
    .from(confessions)
    .where(and(eq(confessions.id, confessionId), eq(confessions.guildId, interaction.guildId)));

  if (!original) {
    await interaction.editReply(`Confession #${confessionId} could not be found. 🍃`);
    return;
  }

  const channel = await interaction.client.channels.fetch(config.confessionsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("Could not find the confessions channel.");
    return;
  }

  const [reply] = await db
    .insert(confessionReplies)
    .values({
      guildId: interaction.guildId,
      confessionId,
      userId: interaction.user.id,
      username: interaction.user.username,
      content,
    })
    .returning();

  const embed = new EmbedBuilder()
    .setColor(0xc8e6c9)
    .setTitle(`💬 Anonymous Reply to Confession #${confessionId}`)
    .setDescription(content)
    .setFooter({ text: "Anonymous · Garden of Harmony 🍃" })
    .setTimestamp();

  const sent = await (channel as TextChannel).send({ embeds: [embed] });
  await db.update(confessionReplies).set({ messageId: sent.id }).where(eq(confessionReplies.id, reply.id));

  await interaction.editReply(`Your reply to Confession #${confessionId} has been posted anonymously. 🌿`);
}
