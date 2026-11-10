import { EmbedBuilder } from "discord.js";

export function gardenGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x81b891)
    .setTitle("🌸 Welcome to the Garden of Harmony")
    .setURL("https://gardenofharmony.up.railway.app/garden")
    .setDescription("Every eligible contribution helps our shared Harmony Tree grow. There are no daily streaks or penalties for taking a break. 💚")
    .addFields(
      { name: "🌳 1. Meet the Harmony Tree", value: "Use `/garden view` to see its live growth and our community flower beds." },
      { name: "🌻 2. Plant a seed", value: "Use `/garden plant` and select a flower or vegetable. You can plant once each day." },
      { name: "💧 3. Help flowers grow", value: "Use `/garden plants` for IDs, then `/garden water`. You may water three plants per day. Three waterings mature a plant." },
      { name: "🧺 4. Harvest and decorate", value: "Harvest your own mature plants with `/garden harvest`, and add seasonal decorations with `/garden decorate`." },
      { name: "💬 5. Join in naturally", value: "Eligible chats and emoji reactions grow the tree too. Faye and Lilith help!" },
      { name: "🏅 6. Celebrate progress", value: "Try `/garden profile` for a shareable card and `/garden badges` to see achievements." },
    )
    .setFooter({ text: "🌿 One community tree • A cozy, pressure-free place to grow" });
}
