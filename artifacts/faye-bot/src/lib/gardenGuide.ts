import { EmbedBuilder } from "discord.js";

export function gardenGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x81b891)
    .setTitle("🌸 Welcome to the Garden of Harmony")
    .setURL("https://gardenofharmony.up.railway.app/garden")
    .setDescription("Every eligible contribution helps our shared Harmony Tree grow. There are no daily streaks or penalties for taking a break. 💚")
    .addFields(
      { name: "🌳 1. Meet the Harmony Tree", value: "Use `/garden view` to see its live growth and our community flower beds." },
      { name: "🌻 2. Plant a seed", value: "Use `/garden plant` to pick a seed from an easy menu. Seasonal plants are limited-time choices but stay in your garden afterward. You can plant once each day." },
      { name: "💧 3. Help flowers grow", value: "Run `/garden water member:@friend` to choose from their plants without looking up IDs (or `/garden water` for your own). You can water three plants each day; three waterings mature a plant." },
      { name: "🧺 4. Harvest and decorate", value: "Harvest your own mature plants with `/garden harvest`, and add seasonal decorations with `/garden decorate`." },
      { name: "💬 5. Join in naturally", value: "Eligible chats give +1 point and emoji reactions give +1 point. Reply directly to today\'s official QOTD for +5 total growth points, or vote in today\'s native Daily Poll for +3. Each daily bonus counts once per member. Faye and Lilith help too!" },
      { name: "🏅 6. Celebrate progress", value: "Try `/garden profile` for a shareable card and `/garden badges` to see achievements." },
    )
    .setFooter({ text: "🌿 One community tree • A cozy, pressure-free place to grow" });
}
