import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db, warnings } from "../lib/database";
import { eq, and, count } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Issue a warning to a member")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName("member").setDescription("The member to warn").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the warning").setRequired(true).setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const target = interaction.options.getUser("member", true);
  const reason = interaction.options.getString("reason", true);

  if (target.id === interaction.user.id) {
    await interaction.editReply("You cannot warn yourself. 🍃");
    return;
  }
  if (target.bot) {
    await interaction.editReply("You cannot warn a bot. 🍃");
    return;
  }

  const [inserted] = await db
    .insert(warnings)
    .values({
      guildId: interaction.guildId,
      userId: target.id,
      username: target.username,
      moderatorId: interaction.user.id,
      moderatorUsername: interaction.user.username,
      reason,
    })
    .returning();

  // Count total warnings for this member
  const [{ value: totalWarnings }] = await db
    .select({ value: count() })
    .from(warnings)
    .where(and(eq(warnings.guildId, interaction.guildId), eq(warnings.userId, target.id)));

  // DM the warned member
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffb74d)
    .setTitle("⚠️ You have received a warning")
    .setDescription(
      `You have been warned in **${interaction.guild?.name}**.\n\n` +
      `**Reason:** ${reason}\n\n` +
      `This is warning **#${totalWarnings}** on your account. Please review the server rules to avoid further action.`
    )
    .setFooter({ text: "Garden of Harmony · If you have questions, please contact a staff member" })
    .setTimestamp();

  let dmSent = true;
  try {
    await target.send({ embeds: [dmEmbed] });
  } catch {
    dmSent = false;
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xffb74d)
    .setTitle(`⚠️ Warning issued — #${inserted.id}`)
    .addFields(
      { name: "Member", value: `<@${target.id}> (${target.username})`, inline: true },
      { name: "Total warnings", value: String(totalWarnings), inline: true },
      { name: "Reason", value: reason },
      { name: "DM sent", value: dmSent ? "✅ Yes" : "❌ No (DMs closed)", inline: true }
    )
    .setFooter({ text: `Warning ID: ${inserted.id} · Issued by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}
