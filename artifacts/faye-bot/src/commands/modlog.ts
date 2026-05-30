import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { db, confessions, suggestions } from "../lib/database";
import { eq, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("modlog")
  .setDescription("[Admin] View the private log of anonymous submissions")
  .addSubcommand((sub) =>
    sub
      .setName("confessions")
      .setDescription("View who submitted each confession")
      .addIntegerOption((opt) =>
        opt.setName("limit").setDescription("How many to show (default 10, max 25)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("suggestions")
      .setDescription("View who submitted each suggestion")
      .addIntegerOption((opt) =>
        opt.setName("limit").setDescription("How many to show (default 10, max 25)").setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isAdmin = member?.permissions.has("Administrator");

  if (!isAdmin) {
    await interaction.editReply("Only server administrators can view the mod log. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();
  const limit = Math.min(interaction.options.getInteger("limit") ?? 10, 25);

  if (sub === "confessions") {
    const rows = await db
      .select()
      .from(confessions)
      .where(eq(confessions.guildId, interaction.guildId))
      .orderBy(desc(confessions.createdAt))
      .limit(limit);

    if (rows.length === 0) {
      await interaction.editReply("No confessions logged yet.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle(`🔒 Confession Log (last ${rows.length})`)
      .setDescription(
        rows
          .map((r) => {
            const time = r.createdAt ? `<t:${Math.floor(r.createdAt.getTime() / 1000)}:R>` : "";
            const preview = r.content.length > 60 ? r.content.slice(0, 60) + "…" : r.content;
            return `**#${r.id}** <@${r.userId}> (${r.username}) ${time}\n> ${preview}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "This log is only visible to admins · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "suggestions") {
    const rows = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.guildId, interaction.guildId))
      .orderBy(desc(suggestions.createdAt))
      .limit(limit);

    if (rows.length === 0) {
      await interaction.editReply("No suggestions logged yet.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x81c784)
      .setTitle(`🔒 Suggestion Log (last ${rows.length})`)
      .setDescription(
        rows
          .map((r) => {
            const time = r.createdAt ? `<t:${Math.floor(r.createdAt.getTime() / 1000)}:R>` : "";
            const preview = r.content.length > 60 ? r.content.slice(0, 60) + "…" : r.content;
            const votes = `✅ ${r.yesVotes ?? 0} / ❌ ${r.noVotes ?? 0}`;
            return `**#${r.id}** <@${r.userId}> (${r.username}) ${time} · ${votes}\n> ${preview}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "This log is only visible to admins · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
  }
}
