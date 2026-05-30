import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db, confessions, suggestions, guildConfig } from "../lib/database";
import { eq, desc, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("modlog")
  .setDescription("[Admin] View or delete anonymous submissions")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete-confession")
      .setDescription("Delete a confession from the channel and database")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The confession ID (from /modlog confessions)").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for removal (optional, for your own records)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete-suggestion")
      .setDescription("Delete a suggestion from the channel and database")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The suggestion ID (from /modlog suggestions)").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for removal (optional, for your own records)").setRequired(false)
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
    await interaction.editReply("Only server administrators can use mod log commands. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();

  // ── VIEW CONFESSIONS ──────────────────────────────────────────────────────
  if (sub === "confessions") {
    const limit = Math.min(interaction.options.getInteger("limit") ?? 10, 25);
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
      .setFooter({ text: "Use /modlog delete-confession <id> to remove · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── VIEW SUGGESTIONS ──────────────────────────────────────────────────────
  if (sub === "suggestions") {
    const limit = Math.min(interaction.options.getInteger("limit") ?? 10, 25);
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
      .setFooter({ text: "Use /modlog delete-suggestion <id> to remove · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── DELETE CONFESSION ─────────────────────────────────────────────────────
  if (sub === "delete-confession") {
    const id = interaction.options.getInteger("id", true);
    const reason = interaction.options.getString("reason") ?? "No reason given";

    const [row] = await db
      .select()
      .from(confessions)
      .where(and(eq(confessions.id, id), eq(confessions.guildId, interaction.guildId)));

    if (!row) {
      await interaction.editReply(`No confession with ID #${id} found in this server.`);
      return;
    }

    // Delete the public message if we have its ID
    if (row.messageId) {
      const [config] = await db
        .select()
        .from(guildConfig)
        .where(eq(guildConfig.guildId, interaction.guildId));

      if (config?.confessionsChannelId) {
        try {
          const channel = await interaction.client.channels.fetch(config.confessionsChannelId);
          if (channel && channel.type === ChannelType.GuildText) {
            const msg = await (channel as TextChannel).messages.fetch(row.messageId);
            await msg.delete();
          }
        } catch {
          // Message may already be deleted — continue anyway
        }
      }
    }

    await db.delete(confessions).where(eq(confessions.id, id));

    await interaction.editReply(
      `✅ Confession #${id} has been removed from the channel and database.\n**Submitted by:** <@${row.userId}> (${row.username})\n**Reason:** ${reason}`
    );
    return;
  }

  // ── DELETE SUGGESTION ─────────────────────────────────────────────────────
  if (sub === "delete-suggestion") {
    const id = interaction.options.getInteger("id", true);
    const reason = interaction.options.getString("reason") ?? "No reason given";

    const [row] = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.id, id), eq(suggestions.guildId, interaction.guildId)));

    if (!row) {
      await interaction.editReply(`No suggestion with ID #${id} found in this server.`);
      return;
    }

    // Delete the public message if we have its ID
    if (row.messageId) {
      const [config] = await db
        .select()
        .from(guildConfig)
        .where(eq(guildConfig.guildId, interaction.guildId));

      if (config?.suggestionsChannelId) {
        try {
          const channel = await interaction.client.channels.fetch(config.suggestionsChannelId);
          if (channel && channel.type === ChannelType.GuildText) {
            const msg = await (channel as TextChannel).messages.fetch(row.messageId);
            await msg.delete();
          }
        } catch {
          // Message may already be deleted — continue anyway
        }
      }
    }

    await db.delete(suggestions).where(eq(suggestions.id, id));

    await interaction.editReply(
      `✅ Suggestion #${id} has been removed from the channel and database.\n**Submitted by:** <@${row.userId}> (${row.username})\n**Reason:** ${reason}`
    );
  }
}
