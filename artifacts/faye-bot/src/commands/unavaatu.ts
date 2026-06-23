import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db, events, titleReservations } from "../lib/database";

const ALLOWED_HOURS_UTC = [
  10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 0, 1,
];

async function ensureUnavaatuTables() {

  await db.execute(sql`

    DROP TABLE IF EXISTS title_reservations;

    CREATE TABLE title_reservations (

      id SERIAL PRIMARY KEY,

      event_id INTEGER,

      guild_id TEXT NOT NULL,

      discord_user_id TEXT NOT NULL,

      server TEXT NOT NULL,

      in_game_name TEXT NOT NULL,

      coordinates TEXT NOT NULL,

      title TEXT NOT NULL,

      date TEXT NOT NULL,

      hour_utc INTEGER NOT NULL,

      created_at TIMESTAMP DEFAULT NOW()

    );

    CREATE TABLE IF NOT EXISTS events (

      id SERIAL PRIMARY KEY,

      guild_id TEXT NOT NULL,

      event_type TEXT NOT NULL,

      title TEXT NOT NULL,

      description TEXT,

      server TEXT,

      start_time TIMESTAMP NOT NULL,

      end_time TIMESTAMP NOT NULL,

      created_by TEXT,

      created_at TIMESTAMP DEFAULT NOW(),

      updated_at TIMESTAMP DEFAULT NOW()

    );

  `);

}

    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS event_id INTEGER;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS guild_id TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS discord_user_id TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS server TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS in_game_name TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS coordinates TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS date TEXT;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS hour_utc INTEGER;
    ALTER TABLE title_reservations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);
}

function getUpcomingUnavaatuDates(limit = 20) {
  const dates: { name: string; value: string }[] = [];
  const now = new Date();

  const tuesdayAnchor = new Date("2026-06-30T00:00:00Z");

  for (let i = 0; dates.length < limit && i < 365 * 5; i++) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(now.getUTCDate() + i);

    const day = d.getUTCDay();
    let allowed = day === 1;

    if (day === 2 && d >= tuesdayAnchor) {
      const daysSinceAnchor = Math.floor(
        (d.getTime() - tuesdayAnchor.getTime()) / 86400000
      );

      const weeksSinceAnchor = Math.floor(daysSinceAnchor / 7);

      if (weeksSinceAnchor % 2 === 0) {
        allowed = true;
      }
    }

    if (!allowed) continue;

    dates.push({
      name: `${d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })} UTC`,
      value: d.toISOString().slice(0, 10),
    });
  }

  return dates;
}

function getEventStart(date: string, hourUtc: number) {
  const eventDate = new Date(`${date}T00:00:00Z`);

  if (hourUtc === 0 || hourUtc === 1) {
    eventDate.setUTCDate(eventDate.getUTCDate() + 1);
  }

  eventDate.setUTCHours(hourUtc, 0, 0, 0);
  return eventDate;
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
          .setName("in_game_name")
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
  await interaction.deferReply({ ephemeral: true });

  await ensureUnavaatuTables();

  const server = interaction.options.getString("server", true);
  const inGameName = interaction.options
    .getString("in_game_name", true)
    .trim();
  const coordinates = interaction.options.getString("coordinates", true).trim();
  const date = interaction.options.getString("date", true);
  const hourUtc = interaction.options.getInteger("time", true);
  const title = interaction.options.getString("title", true);

  const takenTitle = await db
    .select()
    .from(titleReservations)
    .where(
      and(
        eq(titleReservations.guildId, interaction.guildId!),
        eq(titleReservations.server, server),
        eq(titleReservations.date, date),
        eq(titleReservations.hourUtc, hourUtc),
        eq(titleReservations.title, title)
      )
    );

  if (takenTitle.length > 0) {
    await interaction.editReply({
      content: `❌ That slot is already taken: **S${server} | ${title} | ${date} | ${hourUtc
        .toString()
        .padStart(2, "0")}:00 UTC**`,
    });
    return;
  }

  const sameNameSameHour = await db
    .select()
    .from(titleReservations)
    .where(
      and(
        eq(titleReservations.guildId, interaction.guildId!),
        eq(titleReservations.server, server),
        eq(titleReservations.date, date),
        eq(titleReservations.hourUtc, hourUtc),
        eq(titleReservations.inGameName, inGameName)
      )
    );

  if (sameNameSameHour.length > 0) {
    await interaction.editReply({
      content: `❌ **${inGameName}** already has a reservation at that same time.`,
    });
    return;
  }

  const start = getEventStart(date, hourUtc);
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + 1);

  const unixStart = Math.floor(start.getTime() / 1000);
  const eventTitle = `UNAVAATU | S${server} | ${title} | ${inGameName}`;

  const insertedEvents = await db
    .insert(events)
    .values({
      guildId: interaction.guildId!,
      eventType: "UNAVAATU",
      title: eventTitle,
      description:
        `In-game name: ${inGameName}\n` +
        `Coordinates: ${coordinates}\n` +
        `Reserved by: ${interaction.user.tag}`,
      server,
      startTime: start,
      endTime: end,
      createdBy: interaction.user.id,
    })
    .returning({ id: events.id });

  const eventId = insertedEvents[0]?.id ?? null;

  await db.insert(titleReservations).values({
    eventId,
    guildId: interaction.guildId!,
    discordUserId: interaction.user.id,
    server,
    inGameName,
    coordinates,
    title,
    date,
    hourUtc,
  });

  const embed = new EmbedBuilder()
    .setTitle("🌑 UNAVAATU Reservation Confirmed")
    .setColor(0x7c3aed)
    .addFields(
      { name: "Server", value: `S${server}`, inline: true },
      { name: "Title", value: title, inline: true },
      { name: "Player", value: inGameName, inline: true },
      { name: "Coordinates", value: coordinates, inline: false },
      {
        name: "UTC Time",
        value: `${hourUtc.toString().padStart(2, "0")}:00–${end
          .getUTCHours()
          .toString()
          .padStart(2, "0")}:00 UTC`,
        inline: true,
      },
      {
        name: "Local Time",
        value: `<t:${unixStart}:F>`,
        inline: true,
      },
      {
        name: "Reserved By",
        value: `${interaction.user}`,
        inline: false,
      }
    )
    .setFooter({ text: `Raid date: ${date}` })
    .setTimestamp();

  const channelId = process.env.UNAVAATU_CHANNEL_ID;

  if (channelId) {
    const channel = await interaction.client.channels.fetch(channelId);

    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed] });
    }
  }

  await interaction.editReply({
    content: `✅ Your Unavaatu reservation is confirmed: **${eventTitle}**`,
  });
}