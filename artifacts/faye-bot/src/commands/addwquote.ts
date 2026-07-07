import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { db, wisdomQuotes } from "../lib/database";

export const data = new SlashCommandBuilder()
  .setName("addwquotes")
  .setDescription("Bulk add wisdom quotes to Faye.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((option) =>
    option
      .setName("quotes")
      .setDescription("Paste quotes here. Put each quote on a new line.")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const rawQuotes = interaction.options.getString("quotes", true);

  const quotes = rawQuotes
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  if (quotes.length === 0) {
    await interaction.reply({
      content: "No quotes found. Put each quote on its own line.",
      ephemeral: true,
    });
    return;
  }

  if (quotes.length > 100) {
    await interaction.reply({
      content: "Please add 100 quotes or fewer at a time.",
      ephemeral: true,
    });
    return;
  }

  try {
    await db.insert(wisdomQuotes).values(
      quotes.map((quote) => ({
        quote,
      }))
    );

    await interaction.reply({
      content: `Added **${quotes.length}** wisdom quote(s) to Faye. 🍃`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("Error bulk adding wisdom quotes:", err);

    await interaction.reply({
      content: "Something went wrong while saving the quotes.",
      ephemeral: true,
    });
  }
}
