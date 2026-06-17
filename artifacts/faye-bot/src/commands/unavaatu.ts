import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

const ALLOWED_HOURS_UTC = [
  10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 0, 1,
];

function getUpcomingUnavaatuDates(limit = 20) {
  const dates: { name: string; value: string }[] = [];
  const now = new Date();

  // Every-other-Tuesday pattern:
  // Not this coming Tuesday, yes the next one.
  const tuesdayAnchor = new Date("2026-06-30T00:00:00Z");

  for (let i = 0; dates.length < limit && i < 365 * 5; i++) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(now.getUTCDate() + i);

    const day = d.getUTCDay(); // 1 = Monday, 2 = Tuesday

    let allowed = false;

    if (day === 1) {
      allowed = true;
    }

    if (day === 2 && d >= tuesdayAnchor) {
      const daysSinceAnchor = Math.floor(
        (d.getTime() - tuesdayAnchor.getTime()) / (1000 * 60 * 60 * 24)
      );

      const weeksSinceAnchor = Math.floor(daysSinceAnchor / 7);

      if (weeksSinceAnchor % 2 === 0) {
        allowed = true;
      }
    }

    if (!allowed) continue;

    const value = d.toISOString().slice(0, 10);

    const name = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

    dates.push({
      name: `${name} UTC`,
      value,
    });
  }

  return dates;
}

export const data = new SlashCommandBuilder()
  .setName("unavaatu")
  .setDescription("Reserve and manage Unavaatu titles.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reserve")
      .setDescription("Reserve a title.")

      .addStringOption((option) =>
        option
          .setName("server")
          .setDescription("Choose the server.")
          .setRequired(true)
          .addChoices(
            { name: "Server 11", value: "11" },
            { name: "Server 40", value: "40" }
          )
      )

      .addStringOption((option) =>
        option
          .setName("ign")
          .setDescription("Your in-game name.")
          .setRequired(true)
      )

      .addStringOption((option) =>
        option
          .setName("coordinates")
          .setDescription("Coordinates, example: X:123 Y:456.")
          .setRequired(true)
      )

      .addStringOption((option) => {
        option
          .setName("date")
          .setDescription("Choose the reservation date.")
          .setRequired(true);

        for (const date of getUpcomingUnavaatuDates(20)) {
          option.addChoices(date);
        }

        return option;
      })

      .addIntegerOption((option) => {
        option
          .setName("time")
          .setDescription("Choose the UTC time.")
          .setRequired(true);

        for (const hour of ALLOWED_HOURS_UTC) {
          option.addChoices({
            name: `${hour.toString().padStart(2, "0")}:00 UTC`,
            value: hour,
          });
        }

        return option;
      })

      .addStringOption((option) =>
        option
          .setName("title")
          .setDescription("Choose the title.")
          .setRequired(true)
          .addChoices(
            { name: "Guardian of Fire", value: "Guardian of Fire" },
            { name: "General", value: "General" }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand !== "reserve") {
    await interaction.reply({
      content: "Unknown Unavaatu command.",
      ephemeral: true,
    });
    return;
  }

  const server = interaction.options.getString("server", true);
  const ign = interaction.options.getString("ign", true);
  const coordinates = interaction.options.getString("coordinates", true);
  const date = interaction.options.getString("date", true);
  const time = interaction.options.getInteger("time", true);
  const title = interaction.options.getString("title", true);

  await interaction.reply({
    content:
      `🌑 **Unavaatu reservation received!**\n\n` +
      `**Server:** ${server}\n` +
      `**IGN:** ${ign}\n` +
      `**Coordinates:** ${coordinates}\n` +
      `**Date:** ${date}\n` +
      `**Time:** ${time.toString().padStart(2, "0")}:00 UTC\n` +
      `**Title:** ${title}`,
    ephemeral: true,
  });
}
