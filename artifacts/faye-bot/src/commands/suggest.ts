import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
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
    .setTitle(`🍃 Suggestion #${inserted.id}`)
    .setDescription(idea)
    .setFooter({ text: "Vote below · Garden of Harmony" })
    .setTimestamp();

  const sent = await (channel as TextChannel).send({ embeds: [embed] });

  // Add reaction votes
  await sent.react("👍");
  await sent.react("🤔");
  await sent.react("❌");

  await db.update(suggestions).set({ messageId: sent.id }).where(eq(suggestions.id, inserted.id));

  await interaction.editReply("Your suggestion has been planted in the garden. 🌱 Thank you for helping it grow!");
}
