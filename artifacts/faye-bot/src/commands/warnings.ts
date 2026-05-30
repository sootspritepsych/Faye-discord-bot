import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db, warnings } from "../lib/database";
import { eq, and, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("View or manage a member's warning history")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View all warnings for a member")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to look up").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a specific warning by ID")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Warning ID to remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear ALL warnings for a member")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to clear warnings for").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const sub = interaction.options.getSubcommand();

  // ── VIEW ──────────────────────────────────────────────────────────────────
  if (sub === "view") {
    const target = interaction.options.getUser("member", true);

    const rows = await db
      .select()
      .from(warnings)
      .where(and(eq(warnings.guildId, interaction.guildId), eq(warnings.userId, target.id)))
      .orderBy(desc(warnings.createdAt));

    if (rows.length === 0) {
      await interaction.editReply(`<@${target.id}> has no warnings. 🌿`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffb74d)
      .setTitle(`⚠️ Warnings for ${target.username} (${rows.length} total)`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        rows
          .map((w) => {
            const time = w.createdAt ? `<t:${Math.floor(w.createdAt.getTime() / 1000)}:R>` : "";
            return `**#${w.id}** ${time}\n> ${w.reason}\n> *Issued by ${w.moderatorUsername}*`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "Use /warnings remove <id> to remove a specific warning" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── REMOVE ONE ────────────────────────────────────────────────────────────
  if (sub === "remove") {
    const id = interaction.options.getInteger("id", true);

    const [row] = await db
      .select()
      .from(warnings)
      .where(and(eq(warnings.id, id), eq(warnings.guildId, interaction.guildId)));

    if (!row) {
      await interaction.editReply(`No warning with ID #${id} found in this server.`);
      return;
    }

    await db.delete(warnings).where(eq(warnings.id, id));

    await interaction.editReply(
      `✅ Warning #${id} removed.\n**Was issued to:** <@${row.userId}> (${row.username})\n**Reason was:** ${row.reason}`
    );
    return;
  }

  // ── CLEAR ALL ─────────────────────────────────────────────────────────────
  if (sub === "clear") {
    const target = interaction.options.getUser("member", true);

    const existing = await db
      .select()
      .from(warnings)
      .where(and(eq(warnings.guildId, interaction.guildId), eq(warnings.userId, target.id)));

    if (existing.length === 0) {
      await interaction.editReply(`<@${target.id}> has no warnings to clear.`);
      return;
    }

    await db
      .delete(warnings)
      .where(and(eq(warnings.guildId, interaction.guildId), eq(warnings.userId, target.id)));

    await interaction.editReply(
      `✅ Cleared **${existing.length}** warning${existing.length !== 1 ? "s" : ""} from <@${target.id}> (${target.username}).`
    );
  }
}
