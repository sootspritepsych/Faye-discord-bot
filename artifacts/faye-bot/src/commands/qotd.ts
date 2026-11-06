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
    }

    const embed = new EmbedBuilder()
      .setColor(0xc8e6c9)
      .setTitle("💬 New QOTD Suggestion")
      .setDescription(`**${question}**`)
      .addFields(
        { name: "Suggestion ID", value: `#${inserted.id}`, inline: true },
        { name: "Submitted By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Approve", value: `/qotd approve id:${inserted.id}` },
        { name: "Reject", value: `/qotd reject id:${inserted.id}` }
      )
      .setFooter({ text: `Submitted by ${interaction.user.username} · Garden of Harmony` })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });

    await interaction.editReply(
      "Your question has been sent to the mods for review. Thank you! 🌸"
    );
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply("Only staff members can use this command. 🍃");
    return;
  }

  if (sub === "list" || sub === "queue") {
    const approved = sub === "queue";
    const rows = await db
      .select()
      .from(qotdSuggestions)
      .where(
        and(
          eq(qotdSuggestions.guildId, guildId),
          eq(qotdSuggestions.approved, approved),
          eq(qotdSuggestions.used, false)
        )
      )
      .orderBy(qotdSuggestions.id);

    if (rows.length === 0) {
      await interaction.editReply(
        approved ? "No approved questions are waiting. 🌿" : "No pending suggestions right now. 🌿"
      );
      return;
    }

    const description = rows
      .slice(0, 10)
      .map(
        (q) =>
          `**#${q.id}** — ${questionPreview(q.question)}\n*by ${q.submittedBy.slice(0, 70)}*`
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(approved ? 0x66bb6a : 0xa5d6a7)
      .setTitle(approved ? "🌸 Approved QOTD Queue" : "🌸 Pending QOTD Suggestions")
      .setDescription(description)
      .setFooter({
        text: `Showing ${Math.min(rows.length, 10)} of ${rows.length} · Garden of Harmony`,
      });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "approve" || sub === "reject") {
    const id = interaction.options.getInteger("id", true);
    const conditions = and(
      eq(qotdSuggestions.guildId, guildId),
      eq(qotdSuggestions.id, id),
      eq(qotdSuggestions.approved, false),
      eq(qotdSuggestions.used, false)
    );

    if (sub === "approve") {
      const [updated] = await db
        .update(qotdSuggestions)
        .set({ approved: true })
        .where(conditions)
        .returning();
      await interaction.editReply(
        updated
          ? `🌸 QOTD #${id} approved! Faye can now select it automatically.`
          : "That suggestion was not found, is already approved, or has been used."
      );
    } else {
      const [deleted] = await db
        .delete(qotdSuggestions)
        .where(conditions)
        .returning();
      await interaction.editReply(
        deleted ? `🗑️ QOTD #${id} rejected and deleted.` : "That pending suggestion was not found."
      );
    }
    return;
  }

  if (sub === "use") {
    const id = interaction.options.getInteger("id", true);
    const result = await postQotd(interaction.client, guildId, id);

    switch (result.status) {
      case "posted":
        await interaction.editReply(
          `🌸 QOTD **#${id}** posted to <#${result.channelId}> and <@&${QOTD_ROLE_ID}> pinged!`
        );
        break;
      case "already_posted":
        await interaction.editReply(
          "🌿 A QOTD has already been posted today. Faye will post the next one tomorrow."
        );
        break;
      case "question_not_found":
        await interaction.editReply("Could not find that QOTD suggestion.");
        break;
      case "question_used":
        await interaction.editReply("That QOTD suggestion has already been used.");
        break;
      case "not_configured":
        await interaction.editReply(
          "No public QOTD post channel is configured. Point qotdPostChannelId at #main first."
        );
        break;
      case "channel_not_found":
        await interaction.editReply("Could not find the configured public QOTD channel.");
        break;
      default:
        await interaction.editReply("No QOTD is available to post.");
    }
  }
}
