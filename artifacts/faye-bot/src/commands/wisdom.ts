import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db, wisdomQuotes, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";
import { postDailyWisdom } from "../lib/wisdomScheduler";

export const data = new SlashCommandBuilder()
  .setName("wisdom")
  .setDescription("Manage Faye's daily wisdom quotes")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("[Mod] Add a wisdom quote to the daily rotation")
      .addStringOption((opt) =>
        opt.setName("quote").setDescription("The wisdom quote").setRequired(true).setMaxLength(300)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("[Mod] View all wisdom quotes")
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("[Mod] Remove a wisdom quote")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Quote ID to remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("post").setDescription("[Mod] Immediately post today's wisdom")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const isMod = interaction.memberPermissions?.has("ManageGuild");
  if (!isMod) {
    await interaction.editReply("Only staff members can manage wisdom quotes. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const quote = interaction.options.getString("quote", true);
    const [inserted] = await db
      .insert(wisdomQuotes)
      .values({ guildId: interaction.guildId, content: quote })
      .returning();

    await interaction.editReply(
      `🍃 Wisdom quote **#${inserted.id}** has been added to the garden:\n\n*"${quote}"*`
    );
    return;
  }

  if (sub === "list") {
    const quotes = await db
      .select()
      .from(wisdomQuotes)
      .where(eq(wisdomQuotes.guildId, interaction.guildId));

    if (quotes.length === 0) {
      await interaction.editReply(
        "No wisdom quotes yet. Use `/wisdom add <quote>` to plant the first one. 🌱"
      );
      return;
    }

    const list = quotes
      .map((q) => `**#${q.id}** ${q.used ? "✓" : "○"} — *${q.content}*`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle("🍃 Wisdom Quote Library")
      .setDescription(list)
      .setFooter({ text: "✓ = already posted · ○ = pending · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "remove") {
    const id = interaction.options.getInteger("id", true);
    const [existing] = await db
      .select()
      .from(wisdomQuotes)
      .where(and(eq(wisdomQuotes.id, id), eq(wisdomQuotes.guildId, interaction.guildId)));

    if (!existing) {
      await interaction.editReply("Could not find that wisdom quote.");
      return;
    }

    await db.delete(wisdomQuotes).where(eq(wisdomQuotes.id, id));
    await interaction.editReply(`Wisdom quote **#${id}** has been removed. 🍃`);
    return;
  }

  if (sub === "post") {
    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    if (!config?.wisdomChannelId) {
      await interaction.editReply(
        "No wisdom channel configured. Use `/setup wisdom-channel` first."
      );
      return;
    }

    await postDailyWisdom(interaction.client, interaction.guildId, config.wisdomChannelId);
    await interaction.editReply("🍃 Today's wisdom has been posted!");
  }
}
