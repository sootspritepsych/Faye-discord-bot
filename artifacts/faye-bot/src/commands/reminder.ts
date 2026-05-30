import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { db, reminders } from "../lib/database";
import { eq, and } from "drizzle-orm";
import { scheduleReminder, cancelReminder } from "../lib/reminderScheduler";
import cron from "node-cron";

export const data = new SlashCommandBuilder()
  .setName("reminder")
  .setDescription("Manage automated vault reminders")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("[Mod] Add a new automated reminder")
      .addStringOption((opt) =>
        opt.setName("message").setDescription("The reminder message").setRequired(true).setMaxLength(500)
      )
      .addStringOption((opt) =>
        opt
          .setName("schedule")
          .setDescription("Cron schedule (e.g. '0 18 * * 1' = Mondays at 6pm UTC)")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("role-id").setDescription("Role ID to tag (optional)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("[Mod] List all active reminders")
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("[Mod] Remove a reminder")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Reminder ID to remove").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const isAdmin = interaction.memberPermissions?.has("ManageGuild");

  if (!isAdmin) {
    await interaction.editReply("Only staff members can manage reminders. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const message = interaction.options.getString("message", true);
    const schedule = interaction.options.getString("schedule", true);
    const roleId = interaction.options.getString("role-id") ?? null;

    if (!cron.validate(schedule)) {
      await interaction.editReply(
        "That cron expression doesn't look right. Example: `0 18 * * 1` = Mondays at 6pm UTC.\n\nUse https://crontab.guru to build your schedule."
      );
      return;
    }

    const [inserted] = await db
      .insert(reminders)
      .values({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        message,
        cronExpression: schedule,
        tagRoleId: roleId,
      })
      .returning();

    scheduleReminder(interaction.client, {
      id: inserted.id,
      channelId: inserted.channelId,
      message: inserted.message,
      cronExpression: inserted.cronExpression,
      tagRoleId: inserted.tagRoleId ?? null,
    });

    await interaction.editReply(
      `Reminder #${inserted.id} scheduled! 🌿\n**Message:** ${message}\n**Schedule:** \`${schedule}\`${roleId ? `\n**Tags role:** <@&${roleId}>` : ""}`
    );
    return;
  }

  if (sub === "list") {
    const all = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.guildId, interaction.guildId), eq(reminders.active, true)));

    if (all.length === 0) {
      await interaction.editReply("No active reminders. 🌿");
      return;
    }

    const list = all
      .map((r) => {
        const tag = r.tagRoleId ? ` | Tags: <@&${r.tagRoleId}>` : "";
        return `**#${r.id}** — ${r.message}\nSchedule: \`${r.cronExpression}\` | Channel: <#${r.channelId}>${tag}`;
      })
      .join("\n\n");

    await interaction.editReply(`**Active Reminders:**\n\n${list}`);
    return;
  }

  if (sub === "remove") {
    const id = interaction.options.getInteger("id", true);

    const [existing] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.guildId, interaction.guildId)));

    if (!existing) {
      await interaction.editReply("Could not find that reminder in this server.");
      return;
    }

    await db.update(reminders).set({ active: false }).where(eq(reminders.id, id));
    cancelReminder(id);
    await interaction.editReply(`Reminder #${id} has been removed. 🍃`);
  }
}
