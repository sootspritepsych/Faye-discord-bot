import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  type Attachment,
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
    sub
      .setName("add")
      .setDescription("[Mod] Add your own QOTD, automatically approved")
      .addStringOption((opt) =>
        opt
          .setName("question")
          .setDescription("The question to add directly to the approved queue")
          .setRequired(true)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("batch")
      .setDescription("[Mod] Paste multiple QOTDs, one per line (auto-approved)")
      .addStringOption((opt) =>
        opt
          .setName("questions")
          .setDescription("Paste one question per line (up to 6000 characters)")
          .setRequired(true)
          .setMaxLength(6000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("import")
      .setDescription("[Mod] Import a .txt file of QOTDs (auto-approved)")
      .addAttachmentOption((opt) =>
        opt
          .setName("file")
          .setDescription("UTF-8 .txt file, one question per line; max 64 KB")
          .setRequired(true)
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

// These imports add approved questions directly to the existing QOTD queue.
// No new database tables or columns are needed beyond the QOTD migration.
const MAX_QUESTION_LENGTH = 500;
const MAX_IMPORT_LINES = 200;
const MAX_IMPORT_BYTES = 64 * 1024;

type ImportResult = {
  added: number;
  duplicates: number;
  tooLong: number;
  invalidLineNumbers: number[];
};

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function cleanQuestionLine(line: string): string {
  return line
    .trim()
    // Handle lists copied from Notes, Sheets, etc.  "1. Question" -> "Question"
    .replace(/^(?:\d{1,3}[.)]|[-*•])\s+/, "")
    .trim();
}

async function saveApprovedQuestions(
  guildId: string,
  submittedBy: string,
  text: string
): Promise<ImportResult> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const nonEmpty = lines
    .map((line, index) => ({ question: cleanQuestionLine(line), line: index + 1 }))
    .filter((item) => item.question.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error("No questions found. Enter one question per line.");
  }
  if (nonEmpty.length > MAX_IMPORT_LINES) {
    throw new Error(
      `This import contains ${nonEmpty.length} questions. Limit: ${MAX_IMPORT_LINES} per batch. Split the list and try again.`
    );
  }

  // Check against ALL previously submitted questions, including already-used
  // QOTDs, so an import does not accidentally reintroduce old questions.
  const existing = await db
    .select({ question: qotdSuggestions.question })
    .from(qotdSuggestions)
    .where(eq(qotdSuggestions.guildId, guildId));
  const seen = new Set(existing.map((q) => normalizeQuestion(q.question)));

  const newQuestions: Array<{
    guildId: string;
    submittedBy: string;
    question: string;
    approved: boolean;
    used: boolean;
  }> = [];
  const result: ImportResult = {
    added: 0,
    duplicates: 0,
    tooLong: 0,
    invalidLineNumbers: [],
  };

  for (const item of nonEmpty) {
    if (item.question.length > MAX_QUESTION_LENGTH) {
      result.tooLong++;
      result.invalidLineNumbers.push(item.line);
      continue;
    }

    const key = normalizeQuestion(item.question);
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);

    newQuestions.push({
      guildId,
      submittedBy,
      question: item.question,
      approved: true,  // Staff-added questions skip the suggestion approval step.
      used: false,
    });
  }

  if (newQuestions.length > 0) {
    await db.insert(qotdSuggestions).values(newQuestions);
    result.added = newQuestions.length;
  }
  return result;
}

async function readQuestionFile(attachment: Attachment): Promise<string> {
  if (!attachment.name.toLowerCase().endsWith(".txt")) {
    throw new Error("Please upload a plain-text .txt file (one question per line).");
  }
  if (attachment.size > MAX_IMPORT_BYTES) {
    throw new Error("The file is too large. Please use a .txt file under 64 KB.");
  }

  const response = await fetch(attachment.url, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error("Discord could not provide the file. Try uploading it again.");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new Error("The file is too large (max 64 KB).");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function formatImportResult(result: ImportResult): string {
  let message =
    `🌸 **${result.added} QOTD${result.added === 1 ? "" : "s"} added and automatically approved!**` +
    `\n🎲 They're now eligible for Faye's daily 2 PM Central rotation.`;
  if (result.duplicates > 0) {
    message += `\n🔁 ${result.duplicates} duplicate(s) skipped (including already-used QOTDs).`;
  }
  if (result.tooLong > 0) {
    const sample = result.invalidLineNumbers.slice(0, 8).join(", ");
    message += `\n⚠️ ${result.tooLong} over-500-character question(s) skipped (line(s): ${sample}${result.invalidLineNumbers.length > 8 ? ", …" : ""}).`;
  }
  return message;
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

  if (sub === "add" || sub === "batch" || sub === "import") {
    try {
      let questionText: string;

      if (sub === "add") {
        questionText = interaction.options.getString("question", true);
      } else if (sub === "batch") {
        questionText = interaction.options.getString("questions", true);
      } else {
        questionText = await readQuestionFile(
          interaction.options.getAttachment("file", true)
        );
      }

      const submittedBy = `${interaction.user.username} (${interaction.user.id})`;
      const result = await saveApprovedQuestions(
        guildId,
        submittedBy,
        questionText
      );
      await interaction.editReply(formatImportResult(result));
    } catch (error) {
      console.error(`❌ QOTD ${sub} failed:`, error);
      const message = error instanceof Error ? error.message : "Unknown error";
      await interaction.editReply(`❌ Could not add QOTDs: ${message}`);
    }
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
