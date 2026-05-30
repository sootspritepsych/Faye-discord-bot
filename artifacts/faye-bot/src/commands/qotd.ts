import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db, qotdSuggestions, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";
import { TextChannel, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("qotd")
  .setDescription("QOTD commands")
  .addSubcommand((sub) =>
    sub
      .setName("suggest")
      .setDescription("Suggest a question of the day for the mods to consider")
      .addStringOption((opt) =>
        opt.setName("question").setDescription("Your QOTD question").setRequired(true).setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("[Mod only] View all pending QOTD suggestions")
  )
  .addSubcommand((sub) =>
    sub
      .setName("use")
      .setDescription("[Mod only] Post a QOTD suggestion to the server")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The ID of the QOTD suggestion to post").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "suggest") {
    const question = interaction.options.getString("question", true);

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    if (!config?.qotdModChannelId) {
      await interaction.editReply(
        "A staff member needs to set up the QOTD mod channel first using `/setup qotd-channel`."
      );
      return;
    }

    const [inserted] = await db
      .insert(qotdSuggestions)
      .values({
        guildId: interaction.guildId,
        submittedBy: interaction.user.username,
        question,
      })
      .returning();

    const channel = await interaction.client.channels.fetch(config.qotdModChannelId);
    if (channel && channel.type === ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setColor(0xc8e6c9)
        .setTitle("💬 New QOTD Suggestion")
        .setDescription(question)
        .addFields({ name: "Suggestion ID", value: String(inserted.id) })
        .setFooter({ text: `Submitted by ${interaction.user.username} · Use /qotd use <id> to post` })
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    }

    await interaction.editReply("Your question has been sent to the mods for review. Thank you! 🌸");
    return;
  }

  // Mod-only commands
  const isAdmin = interaction.memberPermissions?.has("ManageGuild");

  if (!isAdmin) {
    await interaction.editReply("Only staff members can use this command. 🍃");
    return;
  }

  if (sub === "list") {
    const pending = await db
      .select()
      .from(qotdSuggestions)
      .where(and(eq(qotdSuggestions.guildId, interaction.guildId), eq(qotdSuggestions.used, false)));

    if (pending.length === 0) {
      await interaction.editReply("No pending QOTD suggestions right now. 🌿");
      return;
    }

    const list = pending
      .map((q: { id: number; question: string; submittedBy: string }) => `**#${q.id}** — ${q.question} *(by ${q.submittedBy})*`)
      .join("\n");

    await interaction.editReply({ content: `**Pending QOTD Suggestions:**\n\n${list}` });
    return;
  }

  if (sub === "use") {
    const id = interaction.options.getInteger("id", true);

    const [qotd] = await db
      .select()
      .from(qotdSuggestions)
      .where(and(eq(qotdSuggestions.id, id), eq(qotdSuggestions.guildId, interaction.guildId)));

    if (!qotd) {
      await interaction.editReply("Could not find that QOTD suggestion.");
      return;
    }

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    // Post to a general channel or the qotd mod channel
    const channelId = config?.qotdModChannelId;
    if (!channelId) {
      await interaction.editReply("No QOTD channel configured. Use `/setup qotd-channel` first.");
      return;
    }

    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Could not find the QOTD channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x66bb6a)
      .setTitle("🌸 Question of the Day")
      .setDescription(`**${qotd.question}**`)
      .setFooter({ text: "Garden of Harmony · Share your thoughts below!" })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
    await db.update(qotdSuggestions).set({ used: true }).where(eq(qotdSuggestions.id, id));
    await interaction.editReply(`QOTD #${id} has been posted! 🌿`);
  }
}
