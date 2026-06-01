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
import { db, confessions, confessionReplies, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";

const CATEGORY_EMOJIS: Record<string, string> = {
  Funny: "😄",
  Personal: "💚",
  Gaming: "🎮",
  Secret: "🌙",
  Random: "🍃",
};

export const data = new SlashCommandBuilder()
  .setName("confess")
  .setDescription("Submit an anonymous confession or reply to one")
  .addSubcommand((sub) =>
    sub
      .setName("submit")
      .setDescription("Post an anonymous confession")
      .addStringOption((opt) =>
        opt.setName("message").setDescription("Your anonymous confession").setRequired(true).setMaxLength(1000)
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
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reply")
      .setDescription("Anonymously reply to a confession")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The confession number to reply to").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("message").setDescription("Your anonymous reply").setRequired(true).setMaxLength(800)
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

  const channel = await interaction.client.channels.fetch(config.confessionsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("The confessions channel could not be found. Please ask a staff member to reconfigure it.");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "submit") {
    const message = interaction.options.getString("message", true);
    const category = interaction.options.getString("category") ?? "Random";
    const emoji = CATEGORY_EMOJIS[category] ?? "🍃";

    // Insert first to get the ID
    const [inserted] = await db
      .insert(confessions)
      .values({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        content: message,
        category,
      })
      .returning();

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle(`${emoji} ${category} Confession #${inserted.id}`)
      .setDescription(message)
      .setFooter({ text: "Anonymous · Garden of Harmony 🍃" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`confess-reply_${inserted.id}`)
        .setLabel("💬 Reply Anonymously")
        .setStyle(ButtonStyle.Secondary)
    );

    const sent = await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    await db.update(confessions).set({ messageId: sent.id }).where(eq(confessions.id, inserted.id));

    await interaction.editReply("Your confession has been whispered into the garden. 🍃 No one will know it was you.");
    return;
  }

  if (sub === "reply") {
    const confessionId = interaction.options.getInteger("id", true);
    const message = interaction.options.getString("message", true);

    const [original] = await db
      .select()
      .from(confessions)
      .where(and(eq(confessions.id, confessionId), eq(confessions.guildId, interaction.guildId)));

    if (!original) {
      await interaction.editReply(`Confession #${confessionId} could not be found. 🍃`);
      return;
    }

    const [reply] = await db
      .insert(confessionReplies)
      .values({
        guildId: interaction.guildId,
        confessionId,
        userId: interaction.user.id,
        username: interaction.user.username,
        content: message,
      })
      .returning();

    const replyEmbed = new EmbedBuilder()
      .setColor(0xc8e6c9)
      .setTitle(`💬 Anonymous Reply to Confession #${confessionId}`)
      .setDescription(message)
      .setFooter({ text: "Anonymous · Garden of Harmony 🍃" })
      .setTimestamp();

    const sent = await (channel as TextChannel).send({ embeds: [replyEmbed] });
    await db.update(confessionReplies).set({ messageId: sent.id }).where(eq(confessionReplies.id, reply.id));

    await interaction.editReply(`Your reply to Confession #${confessionId} has been posted anonymously. 🌿`);
  }
}
