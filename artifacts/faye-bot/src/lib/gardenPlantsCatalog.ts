import type { Guild } from "discord.js";

/**
 * Species IDs are permanent database keys. Never rename existing keys after
 * launch: old plots must remain waterable and harvestable year-round.
 *
 * Custom emoji convention: upload an emoji named plant_<species> to the
 * Garden of Harmony Discord server. The bot uses it when available, otherwise
 * it displays the safe Unicode fallback.
 */
export const GARDEN_PLANT_CATALOG = [
  { key: "sunflower", label: "Sunflower", fallback: "🌻", season: "all" },
  { key: "tulip", label: "Tulip", fallback: "🌷", season: "all" },
  { key: "rose", label: "Rose", fallback: "🌹", season: "all" },
  { key: "lavender", label: "Lavender", fallback: "🪻", season: "all" },
  { key: "tomato", label: "Tomato", fallback: "🍅", season: "all" },
  { key: "carrot", label: "Carrot", fallback: "🥕", season: "all" },
  { key: "pumpkin", label: "Pumpkin", fallback: "🎃", season: "all" },
  { key: "fern", label: "Fern", fallback: "🌿", season: "all" },

  { key: "cherry_blossom", label: "Cherry Blossom", fallback: "🌸", season: "spring" },
  { key: "wisteria", label: "Wisteria", fallback: "🪻", season: "spring" },
  { key: "bluebell", label: "Bluebell", fallback: "🔔", season: "spring" },
  { key: "peony", label: "Peony", fallback: "🌺", season: "spring" },

  { key: "hibiscus", label: "Hibiscus", fallback: "🌺", season: "summer" },
  { key: "lotus", label: "Lotus", fallback: "🪷", season: "summer" },
  { key: "moonflower", label: "Moonflower", fallback: "🌼", season: "summer" },
  { key: "glow_mushroom", label: "Glowing Mushroom", fallback: "🍄", season: "summer" },

  { key: "red_maple", label: "Red Maple", fallback: "🍁", season: "autumn" },
  { key: "chrysanthemum", label: "Chrysanthemum", fallback: "🌼", season: "autumn" },
  { key: "marigold", label: "Marigold", fallback: "🌼", season: "autumn" },
  { key: "autumn_mushroom", label: "Autumn Mushroom", fallback: "🍄", season: "autumn" },

  { key: "snowdrop", label: "Snowdrop", fallback: "❄️", season: "winter" },
  { key: "holly", label: "Holly", fallback: "🍃", season: "winter" },
  { key: "frosted_rose", label: "Frosted Rose", fallback: "🌹", season: "winter" },
  { key: "crystal_flower", label: "Crystal Flower", fallback: "💠", season: "winter" },
] as const;

export type GardenSpecies = (typeof GARDEN_PLANT_CATALOG)[number]["key"];
export type GardenPlantSeason = "spring" | "summer" | "autumn" | "winter";

export function currentPlantSeason(date = new Date()): GardenPlantSeason {
  const month = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", month: "numeric",
  }).format(date));
  return month >= 3 && month <= 5 ? "spring"
    : month >= 6 && month <= 8 ? "summer"
    : month >= 9 && month <= 11 ? "autumn" : "winter";
}

export function availableGardenPlants(date = new Date()) {
  const season = currentPlantSeason(date);
  return GARDEN_PLANT_CATALOG.filter(p => p.season === "all" || p.season === season);
}

export function isPlantAvailable(species: string, date = new Date()): species is GardenSpecies {
  return availableGardenPlants(date).some(p => p.key === species);
}

export function plantLabel(species: string): string {
  return GARDEN_PLANT_CATALOG.find(p => p.key === species)?.label ?? species.replace(/_/g, " ");
}

function guildPlantEmoji(species: string, guild?: Guild | null) {
  return guild?.emojis.cache.find(emoji => emoji.name === "plant_" + species);
}

export function plantEmoji(species: string, guild?: Guild | null): string {
  return guildPlantEmoji(species, guild)?.toString() ??
    GARDEN_PLANT_CATALOG.find(p => p.key === species)?.fallback ?? "🌱";
}

/** Discord select menus accept an emoji object with an ID for custom emoji. */
export function plantMenuEmoji(species: string, guild?: Guild | null) {
  const custom = guildPlantEmoji(species, guild);
  return custom
    ? { id: custom.id, name: custom.name ?? undefined, animated: custom.animated }
    : GARDEN_PLANT_CATALOG.find(p => p.key === species)?.fallback ?? "🌱";
}
