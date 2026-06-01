import cron from "node-cron";
import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { db, reminders } from "./database";
import { eq } from "drizzle-orm";

const activeCronJobs = new Map<number, cron.ScheduledTask>();

export async function loadReminders(client: Client) {
  const allReminders = await db
    .select()
    .from(reminders)
    .where(eq(reminders.active, true));

  for (const reminder of allReminders) {
    scheduleReminder(client, reminder);
  }

  console.log(`🌿 Loaded ${allReminders.length} active reminders`);
}

export function scheduleReminder(
  client: Client,
  reminder: {
    id: number;
    channelId: string;
    message: string;
    cronExpression: string;
    tagRoleId: string | null;
    eventName?: string | null;
  }
) {
  if (!cron.validate(reminder.cronExpression)) {
    console.error(`Invalid cron expression for reminder ${reminder.id}: ${reminder.cronExpression}`);
    return;
  }

  const task = cron.schedule(reminder.cronExpression, async () => {
    try {
      const channel = await client.channels.fetch(reminder.channelId);
      if (!channel || channel.type !== ChannelType.GuildText) return;

      const textChannel = channel as TextChannel;

      if (reminder.tagRoleId) {
        // Role event reminder — Sprout format
        const eventLabel = reminder.eventName ?? "Event";
        const embed = new EmbedBuilder()
          .setColor(0x81c784)
          .setTitle("🏮 Faye's Lantern")
          .setDescription(
            `<@&${reminder.tagRoleId}>\n\n${reminder.message}\n\n*Sprout has already saved you a seat. 🌱*`
          )
          .setFooter({ text: `${eventLabel} · Garden of Harmony` })
          .setTimestamp();

        await textChannel.send({ embeds: [embed] });
      } else {
        // Standard reminder
        const embed = new EmbedBuilder()
          .setColor(0xa5d6a7)
          .setDescription(`🍃 ${reminder.message}`)
          .setFooter({ text: "Garden of Harmony · Faye 🌿" })
          .setTimestamp();

        await textChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error(`Error sending reminder ${reminder.id}:`, err);
    }
  });

  activeCronJobs.set(reminder.id, task);
}

export function cancelReminder(reminderId: number) {
  const task = activeCronJobs.get(reminderId);
  if (task) {
    task.stop();
    activeCronJobs.delete(reminderId);
  }
}
