import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db, suggestions, guildConfig } from "../lib/database";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Submit an anonymous suggestion for the server")
  .addStringOption((opt) =>
    opt.setName("idea").setDescription("Your suggestion or idea").setRequired(true).setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const [config] = await db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, interaction.guildId));

  if (!config?.suggestionsChannelId) {
    await interaction.editReply(
      "A staff member needs to set up the suggestions channel first using `/setup suggestions-channel`."
    );
    return;
  }

  const idea = interaction.options.getString("idea", true);

  const channel = await interaction.client.channels.fetch(config.suggestionsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("The suggestions channel could not be found. Please ask a staff member to reconfigure it.");
    return;
  }

  const [inserted] = await db
    .insert(suggestions)
    .values({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      content: idea,
    })
    .returning();

  const embed = new EmbedBuilder()
    .setColor(0x81c784)
    .setTitle("🌿 Anonymous Suggestion")
    .setDescription(idea)
    .addFields(
      { name: "✅ Yes", value: "0", inline: true },
      { name: "❌ No", value: "0", inline: true }
    )
    .setFooter({ text: "Vote using the buttons below · Garden of Harmony" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest-yes_${inserted.id}`)
      .setLabel("✅ Yes")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest-no_${inserted.id}`)
      .setLabel("❌ No")
      .setStyle(ButtonStyle.Danger)
  );

  const sent = await (channel as TextChannel).send({ embeds: [embed], components: [row] });

  await db.update(suggestions).set({ messageId: sent.id }).where(eq(suggestions.id, inserted.id));

  await interaction.editReply("Your suggestion has been planted in the garden. 🌱 Thank you for helping it grow!");
}
