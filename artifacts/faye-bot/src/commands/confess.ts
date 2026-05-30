import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db, confessions, guildConfig } from "../lib/database";
import { eq } from "drizzle-orm";

const CATEGORY_EMOJIS: Record<string, string> = {
  Funny: "😄",
  Personal: "💚",
  Gaming: "🎮",
  Secret: "🌙",
  Random: "🍃",
};

export const data = new SlashCommandBuilder()
  .setName("confess")
  .setDescription("Submit an anonymous confession to the confessions channel")
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("Your anonymous confession")
      .setRequired(true)
      .setMaxLength(1000)
  )
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Category of your confession")
      .setRequired(false)
      .addChoices(
        { name: "😄 Funny", value: "Funny" },
        { name: "💚 Personal", value: "Personal" },
        { name: "🎮 Gaming", value: "Gaming" },
        { name: "🌙 Secret", value: "Secret" },
        { name: "🍃 Random", value: "Random" }
      )
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

  if (!config?.confessionsChannelId) {
    await interaction.editReply(
      "A staff member needs to set up the confessions channel first using `/setup confessions-channel`."
    );
    return;
  }

  const message = interaction.options.getString("message", true);
  const category = interaction.options.getString("category") ?? "Random";
  const emoji = CATEGORY_EMOJIS[category] ?? "🍃";

  const channel = await interaction.client.channels.fetch(config.confessionsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("The confessions channel could not be found. Please ask a staff member to reconfigure it.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xa5d6a7)
    .setTitle(`${emoji} ${category} Confession`)
    .setDescription(message)
    .setFooter({ text: "Anonymous · Garden of Harmony" })
    .setTimestamp();

  const sent = await (channel as TextChannel).send({ embeds: [embed] });

  await db.insert(confessions).values({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    content: message,
    messageId: sent.id,
    category,
  });

  await interaction.editReply("Your confession has been whispered into the garden. 🍃 No one will know it was you.");
}
