import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("Learn about Faye, guardian spirit of the Garden of Harmony");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content:
      `🏮 **About Faye**\n\n` +
      `Faye is the guardian spirit of **Garden of Harmony**.\n\n` +
      `She watches over the garden, welcomes travelers, and helps keep the paths blooming.\n\n` +
      `A small forest spirit with deer ears, antlers decorated with flowers and leaves, and a glowing lantern — ` +
      `Faye wanders quietly through the garden alongside her tiny companion **Sprout**.\n\n` +
      `*"Every flower blooms at its own pace." 🍃*`,
    ephemeral: false,
  });
}
