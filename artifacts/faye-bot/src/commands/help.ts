import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Display Faye's guidebook — a list of all available commands");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x81c784)
    .setTitle("🌿 Faye's Guidebook")
    .addFields(
      {
        name: "📜 Member Commands",
        value: [
          "`/confess submit` — post an anonymous confession",
          "`/confess reply <id>` — anonymously reply to a confession",
          "`/suggest` — submit an anonymous server suggestion",
          "`/qotd suggest` — send a question of the day idea to the mods",
          "`/sticky view` — see the pinned message in this channel",
          "`/about` — learn about Faye",
          "`/help` — this guide",
        ].join("\n"),
      },
      {
        name: "💬 Chat with Faye",
        value: "`@Faye <message>` · `!f <message>` · `/faye <message>`",
      },
      {
        name: "🌿 Mod Commands",
        value: [
          "`/warn` `/warnings` — issue and manage member warnings",
          "`/sticky set/remove` — manage sticky messages",
          "`/reminder add/list/remove` — schedule automated reminders",
          "`/qotd list/use` — review and post QOTD suggestions",
          "`/wisdom add/list/remove/post` — manage daily wisdom quotes",
        ].join("\n"),
      },
      {
        name: "⚙️ Admin Commands",
        value: [
          "`/setup` — configure all of Faye's channels and features",
          "`/modlog` — view confession/suggestion authors, delete posts",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Garden of Harmony · Faye 🍃" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
