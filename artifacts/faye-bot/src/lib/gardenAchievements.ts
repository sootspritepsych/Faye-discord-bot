import { pool } from "./database";

/** Computed from existing credited actions, independent of chat XP and coins. */
export const GARDEN_BADGES = [
  { emoji: "🌱", name: "First Bloom", stat: "plants", goal: 1, description: "Plant your first seed" },
  { emoji: "💧", name: "Helping Hands", stat: "waterings", goal: 25, description: "Water 25 plants" },
  { emoji: "🌳", name: "Taking Root", stat: "points", goal: 100, description: "Earn 100 garden growth points" },
  { emoji: "💬", name: "Kind Words", stat: "chats", goal: 50, description: "Contribute 50 eligible messages" },
  { emoji: "💚", name: "Heart Giver", stat: "reactions", goal: 50, description: "Give 50 eligible reactions" },
  { emoji: "🧺", name: "Harvest Keeper", stat: "harvests", goal: 5, description: "Harvest 5 mature plants" },
  { emoji: "✨", name: "Seasonal Spark", stat: "ornaments", goal: 5, description: "Add 5 seasonal decorations" },
  { emoji: "🏵️", name: "Garden Guardian", stat: "points", goal: 500, description: "Earn 500 garden growth points" },
] as const;

export type GardenStat = "points" | "chats" | "reactions" | "plants" | "waterings" | "harvests" | "ornaments";
export type GardenerProgress = Record<GardenStat, number>;
const ACTIVITY_LABELS: Record<Exclude<GardenStat, "points">, string> = {
  chats: "Chatting", reactions: "Sharing reactions", plants: "Planting",
  waterings: "Helping others grow", harvests: "Harvesting", ornaments: "Decorating",
};

export async function getGardenerProgress(guildId: string, userId: string) {
  const query = [
    "SELECT COALESCE(SUM(points),0)::text AS points,",
    " COUNT(*) FILTER (WHERE kind IN ('chat','qotd'))::text AS chats,",
    " COUNT(*) FILTER (WHERE kind='reaction')::text AS reactions,",
    " COUNT(*) FILTER (WHERE kind='plant')::text AS plants,",
    " COUNT(*) FILTER (WHERE kind='water')::text AS waterings,",
    " COUNT(*) FILTER (WHERE kind='harvest')::text AS harvests,",
    " COUNT(*) FILTER (WHERE kind='ornament')::text AS ornaments",
    " FROM faye_garden_activity WHERE guild_id=$1 AND user_id=$2",
  ].join("");
  const result = await pool.query<Record<GardenStat, string>>(query, [guildId, userId]);
  const raw = result.rows[0];
  const totals: GardenerProgress = {
    points: Number(raw?.points ?? 0), chats: Number(raw?.chats ?? 0),
    reactions: Number(raw?.reactions ?? 0), plants: Number(raw?.plants ?? 0),
    waterings: Number(raw?.waterings ?? 0), harvests: Number(raw?.harvests ?? 0),
    ornaments: Number(raw?.ornaments ?? 0),
  };
  const earned = GARDEN_BADGES.filter(badge => totals[badge.stat] >= badge.goal);
  const favorites = (Object.keys(ACTIVITY_LABELS) as Array<Exclude<GardenStat, "points">>)
    .filter(stat => totals[stat] > 0)
    .sort((a, b) => totals[b] - totals[a]);
  return { totals, earned, favorite: favorites.length ? ACTIVITY_LABELS[favorites[0]] : "Just getting started" };
}
