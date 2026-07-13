import {
  ActivityType,
  Client,
  type PresenceStatusData,
} from "discord.js";

export type FayeMoodName =
  | "nurturing"
  | "playful"
  | "curious"
  | "protective"
  | "celebratory"
  | "cozy"
  | "sisterly";

export interface FayeMood {
  name: FayeMoodName;
  status: PresenceStatusData;
  activityType: ActivityType;
  activityText: string;
  chatInstruction: string;
}

const MOOD_ROTATION_INTERVAL_MS =
  20 * 60 * 1_000;

const FAYE_MOODS: FayeMood[] = [
  {
    name: "nurturing",
    status: "online",
    activityType: ActivityType.Listening,
    activityText: "anyone who needs a friend",
    chatInstruction:
      "Faye is currently nurturing. Her replies should feel especially warm, attentive, and emotionally grounded without becoming overly sentimental.",
  },
  {
    name: "playful",
    status: "online",
    activityType: ActivityType.Playing,
    activityText: "hide-and-seek with Sprout",
    chatInstruction:
      "Faye is currently playful. She may use gentle teasing, light humor, and occasional Sprout mischief while remaining kind.",
  },
  {
    name: "curious",
    status: "online",
    activityType: ActivityType.Watching,
    activityText: "the Garden's latest stories",
    chatInstruction:
      "Faye is currently curious. She is more interested in members' stories, pictures, pets, books, games, and hobbies and may ask a natural follow-up question.",
  },
  {
    name: "protective",
    status: "idle",
    activityType: ActivityType.Watching,
    activityText: "over the Garden paths",
    chatInstruction:
      "Faye is currently protective. She should be attentive to boundaries, unfair treatment, isolation, and members who may need calm support.",
  },
  {
    name: "celebratory",
    status: "online",
    activityType: ActivityType.Listening,
    activityText: "your good news",
    chatInstruction:
      "Faye is currently celebratory. She is more likely to notice progress, accomplishments, happy updates, and moments that deserve encouragement.",
  },
  {
    name: "cozy",
    status: "idle",
    activityType: ActivityType.Watching,
    activityText: "the lanterns glow",
    chatInstruction:
      "Faye is currently cozy and calm. Her replies should be softer, relaxed, and concise, with occasional gentle Garden imagery.",
  },
  {
    name: "sisterly",
    status: "online",
    activityType: ActivityType.Watching,
    activityText: "Lilith make questionable choices",
    chatInstruction:
      "Faye is currently feeling sisterly. She may make an occasional affectionate joke about her older sister Lilith while clearly respecting and caring about her.",
  },
];

let currentMood: FayeMood =
  FAYE_MOODS[0];

let moodRotationTimer:
  | NodeJS.Timeout
  | undefined;

function chooseDifferentMood(): FayeMood {
  const availableMoods =
    FAYE_MOODS.filter(
      (mood) =>
        mood.name !== currentMood.name
    );

  if (availableMoods.length === 0) {
    return currentMood;
  }

  const randomIndex = Math.floor(
    Math.random() *
      availableMoods.length
  );

  return (
    availableMoods[randomIndex] ??
    currentMood
  );
}

function applyFayePresence(
  client: Client,
  mood: FayeMood
): void {
  if (!client.user) {
    return;
  }

  client.user.setPresence({
    status: mood.status,
    activities: [
      {
        name: mood.activityText,
        type: mood.activityType,
      },
    ],
  });

  console.log(
    `🌿 Faye mood: ${mood.name} — ${mood.activityText}`
  );
}

export function getCurrentFayeMood():
  FayeMood {
  return {
    ...currentMood,
  };
}

export function rotateFayeMood(
  client: Client
): FayeMood {
  currentMood =
    chooseDifferentMood();

  applyFayePresence(
    client,
    currentMood
  );

  return getCurrentFayeMood();
}

export function startFayeMoodRotation(
  client: Client
): void {
  if (moodRotationTimer) {
    clearInterval(
      moodRotationTimer
    );
  }

  rotateFayeMood(client);

  moodRotationTimer =
    setInterval(
      () => {
        rotateFayeMood(client);
      },
      MOOD_ROTATION_INTERVAL_MS
    );

  moodRotationTimer.unref();
}

export function stopFayeMoodRotation():
  void {
  if (!moodRotationTimer) {
    return;
  }

  clearInterval(
    moodRotationTimer
  );

  moodRotationTimer = undefined;
}
