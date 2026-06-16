import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

const wiseResponses = [
  "The forest whispers yes.",
  "Not yet — patience will serve you well.",
  "The path is unclear, but your instincts know the way.",
  "A gentle yes, if you are willing to act.",
  "Faye senses good energy around this.",
];

const funnyResponses = [
  "The spirits say: absolutely chaotic, but yes.",
  "Ask again after snacks.",
  "Faye consulted a mushroom. The mushroom says no.",
  "Only if Mojo Jojo permits it.",
  "The vibes are suspicious but entertaining.",
];

const rareResponses = [
  "✨ A rare spirit appears... this is your sign.",
  "🌙 The moonlit grove says destiny is moving.",
  "🍃 Faye has never been more certain.",
];

export const data = new SlashCommandBuilder()
  .setName("askfaye")
  .setDescription("Ask Faye a question and receive mystical guidance.")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("What would you like to ask Faye?")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString("question", true);

  const roll = Math.random();
  let response: string;

  if (roll < 0.08) {
    response = rareResponses[Math.floor(Math.random() * rareResponses.length)];
  } else if (roll < 0.45) {
    response = funnyResponses[Math.floor(Math.random() * funnyResponses.length)];
  } else {
    response = wiseResponses[Math.floor(Math.random() * wiseResponses.length)];
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b7ede)
    .setTitle("🎱 Ask Faye")
    .addFields(
      {
        name: "Your question",
        value: question,
      },
      {
        name: "Faye says",
        value: response,
      }
    )
    .setFooter({ text: "The garden has spoken 🌿" });

  await interaction.reply({ embeds: [embed] });
}