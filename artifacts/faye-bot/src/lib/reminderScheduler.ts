import cron from "node-cron";
import { Client, TextChannel, ChannelType } from "discord.js";
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
  reminder: { id: number; channelId: string; message: string; cronExpression: string; tagRoleId: string | null }
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
      const content = reminder.tagRoleId
        ? `<@&${reminder.tagRoleId}> ${reminder.message}`
        : reminder.message;

      await textChannel.send({
        embeds: [
          {
            description: content,
            color: 0x81c784,
            footer: { text: "🌿 Faye · Garden of Harmony" },
          },
        ],
      });
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
