import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getFayeResponse } from "../lib/openai";
import { getRecentConversation, saveConversationMessage } from "../lib/memory";

export const data = new SlashCommandBuilder()
  .setName("faye")
  .setDescription("Ask Faye something.")
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("What would you like to ask Faye?")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const message = interaction.options.getString("message", true);
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    await saveConversationMessage(
      channelId,
      interaction.user.id,
      interaction.user.username,
      "user",
      message
    );

    const recentMessages = await getRecentConversation(channelId);

    const response = await getFayeResponse(
      message,
      interaction.user.username,
      recentMessages
    );

    await interaction.editReply(response);

    await saveConversationMessage(
      channelId,
      interaction.client.user?.id ?? "faye",
      "Faye",
      "assistant",
      response
    );
  } catch (err) {
    console.error("Error getting /faye response:", err);
    await interaction.editReply(
      "The garden winds are restless right now... try again in a moment. 🍃"
    );
  }
}
