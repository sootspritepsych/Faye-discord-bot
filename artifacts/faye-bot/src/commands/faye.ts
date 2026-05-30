import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getFayeResponse } from "../lib/openai";

export const data = new SlashCommandBuilder()
  .setName("faye")
  .setDescription("Chat with Faye, the guardian spirit of the garden")
  .addStringOption((opt) =>
    opt.setName("message").setDescription("What would you like to ask Faye?").setRequired(true).setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const message = interaction.options.getString("message", true);

  try {
    const response = await getFayeResponse(message, interaction.user.username);
    const text = response && response.trim() ? response : "The garden winds are still... try again in a moment. 🍃";
    await interaction.editReply(text);
  } catch (err) {
    console.error("Error getting Faye AI response:", err);
    await interaction.editReply("The garden winds are restless right now... try again in a moment. 🍃");
  }
}
