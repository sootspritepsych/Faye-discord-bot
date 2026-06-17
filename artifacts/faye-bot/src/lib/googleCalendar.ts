import { google } from "googleapis";

function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google Calendar credentials.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

export async function createUnavaatuCalendarEvent({
  server,
  title,
  ign,
  coordinates,
  discordUser,
  start,
  end,
}: {
  server: string;
  title: string;
  ign: string;
  coordinates: string;
  discordUser: string;
  start: Date;
  end: Date;
}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error("Missing GOOGLE_CALENDAR_ID.");
  }

  const calendar = getCalendarClient();

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `UNAVAATU | S${server} | ${title} | ${ign}`,
      description:
        `Player: ${ign}\n` +
        `Discord: ${discordUser}\n` +
        `Server: ${server}\n` +
        `Title: ${title}\n` +
        `Coordinates: ${coordinates}\n\n` +
        `Created by Faye.`,
      start: {
        dateTime: start.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: "UTC",
      },
    },
  });

  return event.data.id ?? null;
}
