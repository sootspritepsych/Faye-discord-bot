import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { db, qotdSuggestions, guildConfig } from "../lib/database";
import { and, eq } from "drizzle-orm";
import { postQotd, QOTD_ROLE_ID } from "../lib/qotdService";

function idOption(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.addIntegerOption((opt) =>
    opt.setName("id").setDescription("QOTD suggestion ID").setRequired(true)
  );
}

export const data = new SlashCommandBuilder()
  .setName("qotd")
  .setDescription("Question of the Day commands")
  .addSubcommand((sub) =>
    sub
      .setName("suggest")
      .setDescription("Suggest a question for the mods to review")
      .addStringOption((opt) =>
        opt
          .setName("question")
          .setDescription("Your QOTD question")
          .setRequired(true)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("[Mod] View pending suggestions")
  )
  .addSubcommand((sub) =>
    idOption(sub.setName("approve").setDescription("[Mod] Add a suggestion to the daily rotation"))
  )
  .addSubcommand((sub) =>
    idOption(sub.setName("reject").setDescription("[Mod] Delete a pending suggestion"))
  )
  .addSubcommand((sub) =>
    sub.setName("queue").setDescription("[Mod] View approved unused questions")
  )
  .addSubcommand((sub) =>
    idOption(sub.setName("use").setDescription("[Mod] Post a question now (counts as today's QOTD)"))
  );

function questionPreview(question: string): string {
  return question.length <= 220 ? question : `${question.slice(0, 219)}…`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "suggest") {
    const question = interaction.options.getString("question", true).trim();
    if (!question) {
      await interaction.editReply("Please include a question.");
      return;
    }

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .limit(1);

    if (!config?.qotdModChannelId) {
      await interaction.editReply(
        "A staff member needs to set up the QOTD mod channel first using `/setup qotd-channel`."
      );
      return;
    }

    const submittedBy = `${interaction.user.username} (${interaction.user.id})`;
    const [inserted] = await db
      .insert(qotdSuggestions)
      .values({ guildId, submittedBy, question, approved: false, used: false })
      .returning();

    const channel = await interaction.client.channels.fetch(config.qotdModChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply(
        "Your suggestion was saved, but I could not find the staff QOTD channel."
      );
      return;
