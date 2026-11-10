import { EmbedBuilder } from "discord.js";

export function gardenGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x81b891)
    .setTitle("🌸 Welcome to the Garden of Harmony")
    .setURL("https://gardenofharmony.up.railway.app/garden")
    .setDescription("Every eligible contribution helps our shared Harmony Tree grow. There are no daily streaks or penalties for taking a break. 💚")
    .addFields(
      { name: "🌳 1. Meet the Harmony Tree", value: "Use `/garden view` to see its live growth and our community flower beds." },
      { name: "🌻 2. Plant a seed", value: "Use `/garden plant` to open a seed picker, then tap the flower or vegetable you want. One planting per day. Seasonal choices change in March, June, September, and December, but planted flowers never expire." },
      { name: "💧 3. Help flowers grow", value: "Use `/garden water` to choose your own plant, or `/garden water member:@friend` to choose theirs. Pick the plant by name and date—no IDs needed. Three waterings mature a plant; you can water three times per day." },
      { name: "🧺 4. Harvest and decorate", value: "Use `/garden harvest` to pick from your own fully watered plants. Add seasonal decorations with `/garden decorate`." },
      { name: "💬 5. Join in naturally", value: "Eligible chats give +1 point and emoji reactions give +1 point. Reply directly to today\'s official QOTD for +5 total growth points, or vote in today\'s native Daily Poll for +3. Each daily bonus counts once per member. Faye and Lilith help too!" },
      { name: "🏅 6. Celebrate progress", value: "Try `/garden profile` for a shareable card and `/garden badges` to see achievements." },
    )
    .setFooter({ text: "🌿 One community tree • A cozy, pressure-free place to grow" });
}
