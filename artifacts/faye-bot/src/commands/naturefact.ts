import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { sql } from "drizzle-orm";
import { db, natureFacts } from "../lib/database";

export const data = new SlashCommandBuilder()
  .setName("naturefact")
  .setDescription("Receive a random nature fact.")
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("Choose a category.")
      .setRequired(false)
      .addChoices(
        { name: "Animals", value: "animals" },
        { name: "Plants", value: "plants" },
        { name: "Ocean", value: "ocean" },
        { name: "Space", value: "space" },
        { name: "National Parks", value: "national_parks" },
        { name: "Fungi", value: "fungi" },
        { name: "Weather", value: "weather" },
        { name: "Geology", value: "geology" }
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const category = interaction.options.getString("category");

  const rows = category
    ? await db
        .select()
        .from(natureFacts)
        .where(sql`${natureFacts.category} = ${category}`)
        .orderBy(sql`RANDOM()`)
        .limit(1)
    : await db
        .select()
        .from(natureFacts)
        .orderBy(sql`RANDOM()`)
        .limit(1);

  if (rows.length === 0) {
    await interaction.reply({
      content: category
        ? "🌿 Faye does not have any facts in that category yet."
        : "🌿 Faye does not have any nature facts yet.",
      ephemeral: true,
    });
    return;
  }

  const fact = rows[0];

  const embed = new EmbedBuilder()
    .setColor(0x6abf69)
    .setTitle("🌲 Nature Fact")
    .setDescription(fact.fact)
    .addFields({
      name: "Category",
      value: fact.category.replace("_", " "),
    })
    .setFooter({ text: "The garden is full of wonders 🌿" });

  await interaction.reply({ embeds: [embed] });
}