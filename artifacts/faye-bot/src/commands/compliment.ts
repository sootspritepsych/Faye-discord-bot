import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

const compliments = [
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

const rareCompliments = [
  "✨ The spirits of the Garden have chosen you today. Keep this blessing close.",
  "🌌 Even on cloudy nights, your light is enough to guide someone home.",
  "🦉 Faye places a tiny glowing feather in your hands. You are deeply appreciated.",
  "🌸 A rare flower blooms in the Garden today, and somehow it feels like you.",
  "🍃 The Garden whispers your name with gratitude.",
  "🌙 Faye tucks a moonbeam into your pocket for when you forget how loved you are.",
  "🦋 A butterfly lands nearby, as if to say you are exactly where you need to be.",
  "🌿 The roots beneath the Garden hum softly. You belong here.",
  "⭐ Faye grants you a tiny star of courage for the road ahead.",
  "🍄 A circle of mushrooms appears. The Garden has decided you are magical.",
];

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
    const target = interaction.options.getUser("user") ?? interaction.user;

    const isRare = Math.random() < 0.05;
    const compliment = isRare
      ? rareCompliments[Math.floor(Math.random() * rareCompliments.length)]
      : compliments[Math.floor(Math.random() * compliments.length)];

    const embed = new EmbedBuilder()
      .setColor(0x77b255)
   .setDescription(`🌿 Faye smiles softly at ${target}.\n\n*“${compliment}”*`);

    await interaction.reply({ embeds: [embed] });
  },
};