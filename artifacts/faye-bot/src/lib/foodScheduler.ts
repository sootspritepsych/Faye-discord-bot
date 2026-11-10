import type { Client } from "discord.js";
import { pool } from "./database";
import { startDailyImageJob, type DailyImage } from "./dailyImageJob";

export async function pickFood(recent: Set<string>): Promise<DailyImage> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch("https://www.themealdb.com/api/json/v1/1/random.php", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Food provider HTTP ${response.status}`);
    const data = await response.json() as { meals?: Array<{ idMeal?: string; strMeal?: string; strMealThumb?: string }> };
    const meal = data.meals?.[0];
    if (!meal || !meal.idMeal || !/^\d+$/.test(meal.idMeal) ||
      !meal.strMeal?.trim() || !meal.strMealThumb) continue;
    const image = new URL(meal.strMealThumb);
    if (image.protocol !== "https:" || image.hostname !== "www.themealdb.com" ||
      !image.pathname.startsWith("/images/media/meals/") || recent.has(meal.idMeal)) continue;
    return {
      id: meal.idMeal, title: meal.strMeal, image: image.href,
      source: `https://www.themealdb.com/meal/${meal.idMeal}`,
      credit: "Food photo: TheMealDB",
    };
  }
  throw new Error("Food provider did not return a new usable food photo");
}

export async function startFoodScheduler(client: Client): Promise<void> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) { console.warn("📷 daily-food: DISCORD_GUILD_ID missing"); return; }
  await startDailyImageJob(client, {
    key: "daily-food", guildId, channelId: process.env.FOODIE_CHANNEL_ID?.trim(),
    channelNames: ["foodie", "foodies"], hour: 12, pool, pick: pickFood,
    content: "Would you eat this? Yes or no?",
  });
}
