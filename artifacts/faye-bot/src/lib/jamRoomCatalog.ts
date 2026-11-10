// Shared by both bot repositories. Keep the anchor, moods and catalogue in sync.
export type Sister = "faye" | "lilith";
export const SONG_MOODS = [
  { name: "😊 Happy", value: "happy" },
  { name: "🍵 Cozy", value: "cozy" },
  { name: "💙 Sad", value: "sad" },
  { name: "⚡ Energetic", value: "energetic" },
  { name: "💕 Romantic", value: "romantic" },
  { name: "🌊 Chill", value: "chill" },
  { name: "🎲 Surprise me", value: "surprise" },
] as const;
export type SongMood = typeof SONG_MOODS[number]["value"];
export interface Song { id: string; title: string; sister: Sister; moods: string[] }
// Spotify oEmbed verified these track links on 2026-11-10. No Spotify login needed.
export const SONGS: readonly Song[] = [
  {
    "id": "0V3wPSX9ygBnCm8psDIegu",
    "title": "Anti-Hero",
    "sister": "lilith",
    "moods": [
      "happy",
      "chill"
    ]
  },
  {
    "id": "2Fxmhks0bxGSBdJ92vM42m",
    "title": "bad guy",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "1mea3bSkSGXuIRvnydlB5b",
    "title": "Viva La Vida",
    "sister": "faye",
    "moods": [
      "happy",
      "chill"
    ]
  },
  {
    "id": "7qiZfU4dY1lWllzX7mPBI3",
    "title": "Shape of You",
    "sister": "lilith",
    "moods": [
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "0tgVpDi06FyKpA1z0VMD4v",
    "title": "Perfect",
    "sister": "faye",
    "moods": [
      "cozy",
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "3e9HZxeyfWwjeyPAMmWSSQ",
    "title": "thank u, next",
    "sister": "lilith",
    "moods": [
      "happy",
      "chill"
    ]
  },
  {
    "id": "7qEHsqek33rTcFNT9PFqLf",
    "title": "Someone You Loved",
    "sister": "lilith",
    "moods": [
      "sad",
      "chill"
    ]
  },
  {
    "id": "5ChkMS8OtdzJeqyybCc9R5",
    "title": "Billie Jean",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "2bgTY4UwhfBYhGT4HUYStN",
    "title": "Butter",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "4saklk6nie3yiGePpBwUoc",
    "title": "Dynamite",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "3AJwUDP919kvQ9QcozQPxg",
    "title": "Yellow",
    "sister": "faye",
    "moods": [
      "cozy",
      "sad",
      "chill"
    ]
  },
  {
    "id": "0d28khcov6AiegSCpG5TuT",
    "title": "Feel Good Inc.",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "2takcwOaAZWiXQijPHIx7B",
    "title": "Time is Running Out",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "5ghIJDpPoe3CfHMGu71E6T",
    "title": "Smells Like Teen Spirit",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "0ofHAoxe9vBkTCp2UQIavz",
    "title": "Dreams - 2004 Remaster",
    "sister": "lilith",
    "moods": [
      "cozy",
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "5XeFesFbtLpXzIVDNQP22n",
    "title": "I Wanna Be Yours",
    "sister": "lilith",
    "moods": [
      "cozy",
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "2tGvwE8GcFKwNdAXMnlbfl",
    "title": "happier",
    "sister": "lilith",
    "moods": [
      "sad",
      "chill"
    ]
  },
  {
    "id": "7yq4Qj7cqayVTp3FF9CWbm",
    "title": "Riptide",
    "sister": "faye",
    "moods": [
      "cozy",
      "happy",
      "chill"
    ]
  },
  {
    "id": "6b8Be6ljOzmkOmFslEb23P",
    "title": "24K Magic",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "2WfaOiMkCvy7F5fcp2zZ8L",
    "title": "Take on Me",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "3H7ihDc1dqLriiWXwsc2po",
    "title": "Breaking Me",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "6habFhsOp2NvshLv26DqMb",
    "title": "Despacito",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "0pqnGHJpmpxLKifKRmU6WP",
    "title": "Believer",
    "sister": "lilith",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "1rqqCSm0Qe4I9rUvWncaom",
    "title": "High Hopes",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "0QZ5yyl6B6utIWkxeBDxQN",
    "title": "The Night We Met",
    "sister": "lilith",
    "moods": [
      "cozy",
      "sad",
      "chill"
    ]
  },
  {
    "id": "0RiRZpuVRbi7oqRdSMwhQY",
    "title": "Sunflower - Spider-Man: Into the Spider-Verse",
    "sister": "faye",
    "moods": [
      "cozy",
      "happy",
      "chill"
    ]
  },
  {
    "id": "60nZcImufyMA1MKQY3dcCH",
    "title": "Happy - From \"Despicable Me 2\"",
    "sister": "faye",
    "moods": [
      "happy",
      "chill"
    ]
  },
  {
    "id": "6UelLqGlWMcVH1E5c4H7lY",
    "title": "Watermelon Sugar",
    "sister": "faye",
    "moods": [
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "2XU0oxnq2qxCpomAAuJY8K",
    "title": "Dance Monkey",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "4Dvkj6JhhA12EX05fT7y2e",
    "title": "As It Was",
    "sister": "faye",
    "moods": [
      "happy",
      "chill"
    ]
  },
  {
    "id": "5Ohxk2dO5COHF1krpoPigN",
    "title": "Sign of the Times",
    "sister": "lilith",
    "moods": [
      "sad",
      "chill"
    ]
  },
  {
    "id": "1HNkqx9Ahdgi1Ixy2xkKkL",
    "title": "Photograph",
    "sister": "faye",
    "moods": [
      "cozy",
      "sad",
      "romantic",
      "chill"
    ]
  },
  {
    "id": "1BxfuPKGuaTgP7aM0Bbdwr",
    "title": "Cruel Summer",
    "sister": "faye",
    "moods": [
      "romantic",
      "happy",
      "chill"
    ]
  },
  {
    "id": "3hWfKBt3n7j1xqIy6LA5ve",
    "title": "Astronomia",
    "sister": "faye",
    "moods": [
      "energetic",
      "happy"
    ]
  },
  {
    "id": "3S8jK1mGzQi24ilFb45DAZ",
    "title": "Lonely (with benny blanco)",
    "sister": "lilith",
    "moods": [
      "sad",
      "chill"
    ]
  },
  {
    "id": "2Ch7LmS7r2Gy2kc64wv3Bz",
    "title": "Die For You",
    "sister": "lilith",
    "moods": [
      "sad",
      "romantic",
      "chill"
    ]
  }
];
export function jamDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse("2026-11-10T00:00:00Z")) / 86400000);
  return { date, hour: Number(get("hour")), sister: (days % 2 === 0 ? "faye" : "lilith") as Sister };
}
export function isSongMood(value: string): value is SongMood {
  return SONG_MOODS.some(m => m.value === value);
}
export function normalizedJamName(name: string): string {
  return name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function songCandidates(sister: Sister, mood: SongMood): readonly Song[] {
  // Mood requests may use the whole library; daily picks use disjoint sister pools.
  return mood === "surprise" ? SONGS.filter(s => s.sister === sister) : SONGS.filter(s => s.moods.includes(mood));
}
export function leastPlayed(songs: readonly Song[], counts: ReadonlyMap<string, number>): readonly Song[] {
  const minimum = Math.min(...songs.map(s => counts.get(s.id) ?? 0));
  return songs.filter(s => (counts.get(s.id) ?? 0) === minimum);
}
export function songText(sister: Sister, song: Song, mood?: SongMood): string {
  const label = mood && mood !== "surprise" ? ` · ${mood}` : "";
  const intro = sister === "faye" ? "🌿 **Faye’s song pick" + label + "**\nA little soundtrack for your day. 🎶" : "🌙 **Lilith’s song pick" + label + "**\nFine. You can have one song from my playlist. 🖤";
  return `${intro}\n**${song.title}**\nhttps://open.spotify.com/track/${song.id}`;
}
