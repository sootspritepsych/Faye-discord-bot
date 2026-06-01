import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db, reminders } from "../lib/database";
import { eq, and } from "drizzle-orm";
import { scheduleReminder, cancelReminder } from "../lib/reminderScheduler";
import cron from "node-cron";

export const data = new SlashCommandBuilder()
  .setName("reminder")
  .setDescription("Manage automated reminders")
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
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Role to ping (optional — uses Sprout event format when set)").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("event-name").setDescription("Event name shown in the footer (e.g. 'Pokémon Night')").setRequired(false)
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

  const isMod = interaction.memberPermissions?.has("ManageGuild");
  if (!isMod) {
    await interaction.editReply("Only staff members can manage reminders. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const message = interaction.options.getString("message", true);
    const schedule = interaction.options.getString("schedule", true);
    const role = interaction.options.getRole("role");
    const eventName = interaction.options.getString("event-name");

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
        tagRoleId: role?.id ?? null,
        eventName: eventName ?? null,
      })
      .returning();

    scheduleReminder(interaction.client, {
      id: inserted.id,
      channelId: inserted.channelId,
      message: inserted.message,
      cronExpression: inserted.cronExpression,
      tagRoleId: inserted.tagRoleId ?? null,
      eventName: inserted.eventName ?? null,
    });

    const embed = new EmbedBuilder()
      .setColor(0x81c784)
      .setTitle("🏮 Reminder Scheduled")
      .addFields(
        { name: "Message", value: message },
        { name: "Schedule", value: `\`${schedule}\``, inline: true },
        { name: "ID", value: `#${inserted.id}`, inline: true }
      );

    if (role) embed.addFields({ name: "Pings", value: `<@&${role.id}>`, inline: true });
    if (eventName) embed.addFields({ name: "Event", value: eventName, inline: true });
    embed.setFooter({ text: "Garden of Harmony · Faye 🍃" });

    await interaction.editReply({ embeds: [embed] });
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

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle("🌿 Active Reminders")
      .setDescription(
        all
          .map((r) => {
            const parts = [`**#${r.id}** — ${r.message}`, `Schedule: \`${r.cronExpression}\` · <#${r.channelId}>`];
            if (r.tagRoleId) parts.push(`Pings: <@&${r.tagRoleId}>`);
            if (r.eventName) parts.push(`Event: ${r.eventName}`);
            return parts.join("\n");
          })
          .join("\n\n")
      )
      .setFooter({ text: "Garden of Harmony · Faye 🍃" });

    await interaction.editReply({ embeds: [embed] });
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
    await interaction.editReply(`Reminder **#${id}** has been removed from the garden. 🍃`);
  }
}
