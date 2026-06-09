import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

const timezones = [
  { name: "UTC", value: "UTC" },
  { name: "US Central", value: "America/Chicago" },
  { name: "US Eastern", value: "America/New_York" },
  { name: "US Mountain", value: "America/Denver" },
  { name: "US Pacific", value: "America/Los_Angeles" },
  { name: "UK", value: "Europe/London" },
  { name: "Europe Paris", value: "Europe/Paris" },
  { name: "Japan", value: "Asia/Tokyo" },
  { name: "Australia Sydney", value: "Australia/Sydney" },
];

const styles = [
  { name: "Full date and time", value: "F" },
  { name: "Short date and time", value: "f" },
  { name: "Time only", value: "t" },
  { name: "Date only", value: "D" },
  { name: "Relative countdown", value: "R" },
];

export const data = new SlashCommandBuilder()
  .setName("timestamp")
  .setDescription("Create copyable Discord local-time text")
  .addStringOption((option) =>
    option
      .setName("date")
      .setDescription("Date in YYYY-MM-DD format")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("time")
      .setDescription("Time in 24-hour HH:MM format, like 20:00")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("timezone")
      .setDescription("Timezone the entered time is in")
      .setRequired(true)
      .addChoices(...timezones),
  )
  .addStringOption((option) =>
    option
      .setName("style")
      .setDescription("How Discord should display it")
      .setRequired(false)
      .addChoices(...styles),
  );

function zonedTimeToUnix(date: string, time: string, timeZone: string): number | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (!year || !month || !day || hour === undefined || minute === undefined) {
    return null;
  }

  let utcGuess = Date.UTC(year, month - 1, day, hour, minute);

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcGuess));

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);

    const asIfUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
    );

    utcGuess += Date.UTC(year, month - 1, day, hour, minute) - asIfUtc;
  }

  return Math.floor(utcGuess / 1000);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const date = interaction.options.getString("date", true);
  const time = interaction.options.getString("time", true);
  const timezone = interaction.options.getString("timezone", true);
  const style = interaction.options.getString("style") ?? "F";

  const unix = zonedTimeToUnix(date, time, timezone);

  if (!unix) {
    await interaction.reply({
      content: "❌ Please use date `YYYY-MM-DD` and time `HH:MM`, like `2026-08-10` and `20:00`.",
      ephemeral: true,
    });
    return;
  }

  const timestamp = `<t:${unix}:${style}>`;
  const relative = `<t:${unix}:R>`;

  await interaction.reply({
    content:
      `🌱 **Discord Timestamp Generated**\n\n` +
      `Copy this:\n` +
      `\`${timestamp}\`\n\n` +
      `Preview:\n${timestamp}\n\n` +
      `Countdown:\n${relative}`,
    ephemeral: true,
  });
}