import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { db, suggestions } from "../lib/database";
import { eq, sql } from "drizzle-orm";

export async function handleSuggestionVote(interaction: ButtonInteraction) {
  const [action, id] = interaction.customId.split("_");

  if (action !== "suggest-yes" && action !== "suggest-no") return;

  const suggestionId = parseInt(id);
  if (isNaN(suggestionId)) return;

  try {
    if (action === "suggest-yes") {
      await db
        .update(suggestions)
        .set({ yesVotes: sql`yes_votes + 1` })
        .where(eq(suggestions.id, suggestionId));
    } else {
      await db
        .update(suggestions)
        .set({ noVotes: sql`no_votes + 1` })
        .where(eq(suggestions.id, suggestionId));
    }

    const [updated] = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.id, suggestionId));

    if (!updated) {
      await interaction.reply({ content: "Could not find that suggestion.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x81c784)
      .setTitle("🌿 Anonymous Suggestion")
      .setDescription(updated.content)
      .addFields(
        { name: "✅ Yes", value: String(updated.yesVotes ?? 0), inline: true },
        { name: "❌ No", value: String(updated.noVotes ?? 0), inline: true }
      )
      .setFooter({ text: "Vote using the buttons below · Garden of Harmony" });

    await interaction.update({ embeds: [embed] });
  } catch (err) {
    console.error("Error handling suggestion vote:", err);
    await interaction.reply({ content: "Something went wrong with the vote. 🍃", ephemeral: true });
  }
}
