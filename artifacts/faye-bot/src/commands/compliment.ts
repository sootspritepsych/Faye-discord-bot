import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getFayeResponse } from "../lib/openai";

const fallbackCompliments = [
  "You make the Garden feel warmer just by being here.",
  "Your kindness leaves little traces of light wherever you go.",
  "The effort you put in matters, even when no one sees it.",
  "You have a calming presence that makes others feel welcome.",
  "You remind others that it is okay to grow at their own pace.",
  "Your authenticity is one of your greatest strengths.",
  "Someone probably smiled today because of something you did.",
  "You make communities stronger simply by showing up.",
  "Your curiosity helps the Garden continue to grow.",
  "You are appreciated more than you know.",
  "You bring a softness to the world that people need.",
  "You have a way of making others feel less alone.",
  "Your presence adds something special to this community.",
  "You are allowed to be proud of how far you have come.",
  "You have survived hard days and still choose kindness.",
  "You are growing, even on the days it does not feel like it.",
  "You are more capable than your doubts want you to believe.",
  "You carry a quiet strength that deserves recognition.",
  "You make the Garden a better place.",
  "Your heart is one of your greatest gifts.",
  "You have a beautiful way of caring.",
  "Your small efforts still matter deeply.",
  "You are someone worth celebrating.",
  "You bring comfort just by being yourself.",
  "You have the kind of energy that helps people feel safe.",
  "The Garden is lucky to have you.",
  "You are doing better than you think.",
  "Your presence here matters.",
  "You are a little spark of good in someone’s day.",
  "You deserve the same kindness you give to others.",
  "You have a gentle magic about you.",
  "You are wonderfully, unmistakably yourself.",
  "Your growth is something to be proud of.",
  "You are not behind. You are blooming in your own season.",
  "You bring color to places that need it.",
  "You are proof that soft things can still be strong.",
  "You have a light that does not need to be loud.",
  "You make ordinary moments feel a little more special.",
  "You are brave in ways you may not even notice.",
  "You are enough, exactly as you are today.",
];

function getFallbackCompliment() {
  return fallbackCompliments[
    Math.floor(Math.random() * fallbackCompliments.length)
  ];
}

export const complimentCommand = {
  data: new SlashCommandBuilder()
    .setName("compliment")
    .setDescription("Give yourself or someone else a gentle compliment from Faye.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Someone to compliment")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;

    let compliment = getFallbackCompliment();

    try {
      const aiPrompt = `
Generate one short, wholesome compliment in Faye's voice.

Faye is a gentle garden spirit for a cozy Discord community called Garden of Harmony.

Rules:
- Under 40 words.
- Do not mention physical appearance.
- Do not be romantic or flirty.
- Do not use the person's real name.
- Be warm, encouraging, cozy, and sincere.
- Light nature/garden imagery is welcome.
- Return only the compliment sentence, no quotes.
`;

      const aiCompliment = await getFayeResponse(aiPrompt);

      if (aiCompliment && aiCompliment.length < 300) {
        compliment = aiCompliment.trim();
      }
    } catch (error) {
      console.error("AI compliment failed, using fallback:", error);
    }

    const embed = new EmbedBuilder()
      .setColor(0x77b255)
      .setDescription(`🌿 Faye smiles softly at ${target}.\n\n*“${compliment}”*`);

    await interaction.editReply({ embeds: [embed] });
  },
};


