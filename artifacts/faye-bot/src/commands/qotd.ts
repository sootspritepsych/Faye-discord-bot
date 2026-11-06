
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
    sub
      .setName("use")
      .setDescription("[Mod] Post a random unused QOTD now")
  );

function questionPreview(question: string): string {
  return question.length <= 220 ? question : `${question.slice(0, 219)}…`;
}

// These imports add approved questions directly to the existing QOTD queue.
// No new database tables or columns are needed beyond the QOTD migration.
const MAX_QUESTION_LENGTH = 500;
const MAX_IMPORT_LINES = 200;
const MAX_IMPORT_BYTES = 64 * 1024;
