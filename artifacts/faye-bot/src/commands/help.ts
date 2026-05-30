import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Display Faye's guidebook — a list of all available commands");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content:
      `🌿 **Faye's Guidebook**\n\n` +
      `**Member Commands**\n` +
      `\`/confess\` — submit an anonymous confession\n` +
      `\`/suggest\` — submit an anonymous suggestion\n` +
      `\`/qotd suggest\` — send a question of the day idea to the mods\n` +
      `\`/sticky view\` — see the pinned message in this channel\n` +
      `\`/about\` — learn about Faye\n` +
      `\`/help\` — this guide\n\n` +
      `**Chat with Faye**\n` +
      `\`@Faye <message>\`\n` +
      `\`!f <message>\`\n` +
      `\`/faye <message>\`\n\n` +
      `**Mod Commands** *(staff only)*\n` +
      `\`/warn\` \`/warnings\` \`/sticky\` \`/reminder\` \`/qotd\`\n\n` +
      `*If you need help, our staff gardeners are always happy to assist. 🍃*`,
    ephemeral: true,
  });
}
