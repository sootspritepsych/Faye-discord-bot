import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db, adultQotdQuestions, guildConfig } from "../lib/database";

export const data = new SlashCommandBuilder()
  .setName("adultqotd")
  .setDescription("Manage Adult QOTD.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set the Adult QOTD channel and daily post hour.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The verified 18+ Adult QOTD channel.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("hour")
          .setDescription("Post hour in bot/server time, 0-23.")
          .setMinValue(0)
          .setMaxValue(23)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add one Adult QOTD question.")
      .addStringOption((option) =>
        option
          .setName("question")
          .setDescription("The question to add.")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("bulkadd")
      .setDescription("Bulk add Adult QOTD questions, one per line.")
      .addStringOption((option) =>
        option
          .setName("questions")
          .setDescription("Paste questions, one per line.")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("use").setDescription("Post one Adult QOTD immediately.")
  )
  .addSubcommand((sub) =>
    sub.setName("reset").setDescription("Mark all Adult QOTDs as unused.")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    const hour = interaction.options.getInteger("hour", true);

    await db
      .insert(guildConfig)
      .values({
        guildId: interaction.guildId,
        adultQotdChannelId: channel.id,
        adultQotdPostHour: hour,
      })
      .onConflictDoUpdate({
        target: guildConfig.guildId,
        set: {
          adultQotdChannelId: channel.id,
          adultQotdPostHour: hour,
          updatedAt: new Date(),
        },
      });

    await interaction.reply({
      content: `🌹 Adult QOTD set to <#${channel.id}> at hour **${hour}:00**.`,
      ephemeral: true,
    });

    return;
  }

  if (subcommand === "add") {
    const question = interaction.options.getString("question", true).trim();

    await db.insert(adultQotdQuestions).values({
      guildId: interaction.guildId,
      question,
    });

    await interaction.reply({
      content: "🌹 Adult QOTD question added.",
      ephemeral: true,
    });

    return;
  }

  if (subcommand === "bulkadd") {
    const raw = interaction.options.getString("questions", true);

    const questions = raw
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    const uniqueQuestions = [...new Set(questions)];

    if (uniqueQuestions.length === 0) {
      await interaction.reply({
        content: "No questions found.",
        ephemeral: true,
      });
      return;
    }

    await db.insert(adultQotdQuestions).values(
      uniqueQuestions.map((question) => ({
        guildId: interaction.guildId!,
        question,
      }))
    );

    await interaction.reply({
      content: `🌹 Added **${uniqueQuestions.length}** Adult QOTD question(s).`,
      ephemeral: true,
    });

    return;
  }

  if (subcommand === "use") {
    const config = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId))
      .limit(1);

    if (!config[0]?.adultQotdChannelId) {
      await interaction.reply({
        content: "Adult QOTD is not set up yet. Use `/adultqotd setup` first.",
        ephemeral: true,
      });
      return;
    }

    const questionRows = await db
      .select()
      .from(adultQotdQuestions)
      .where(
        and(
          eq(adultQotdQuestions.guildId, interaction.guildId),
          eq(adultQotdQuestions.used, false)
        )
      )
      .limit(1);

    if (questionRows.length === 0) {
      await interaction.reply({
        content: "No unused Adult QOTD questions left. Use `/adultqotd reset`.",
        ephemeral: true,
      });
      return;
    }

    const question = questionRows[0];

    const channel = await interaction.client.channels.fetch(
      config[0].adultQotdChannelId
    );

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "I could not find the Adult QOTD channel.",
        ephemeral: true,
      });
      return;
    }

    await (channel as TextChannel).send({
      content:
        `🌹 **Adult QOTD**\n\n` +
        `${question.question}\n\n` +
        `Keep it respectful. Verified 18+ only.`,
    });

    await db
      .update(adultQotdQuestions)
      .set({ used: true })
      .where(eq(adultQotdQuestions.id, question.id));

    await interaction.reply({
      content: "🌹 Adult QOTD posted.",
      ephemeral: true,
    });

    return;
  }

  if (subcommand === "reset") {
    await db
      .update(adultQotdQuestions)
      .set({ used: false })
      .where(eq(adultQotdQuestions.guildId, interaction.guildId));

    await interaction.reply({
      content: "🌹 All Adult QOTD questions have been reset to unused.",
      ephemeral: true,
    });

    return;
  }
}
