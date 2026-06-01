import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db, qotdSuggestions, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";
import { TextChannel, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("qotd")
  .setDescription("Question of the Day commands")
  .addSubcommand((sub) =>
    sub
      .setName("suggest")
      .setDescription("Suggest a question of the day for the mods to review")
      .addStringOption((opt) =>
        opt.setName("question").setDescription("Your QOTD question").setRequired(true).setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("[Mod] View all pending QOTD suggestions")
  )
  .addSubcommand((sub) =>
    sub
      .setName("use")
      .setDescription("[Mod] Post a QOTD suggestion to the server")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The ID of the QOTD suggestion to post").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "suggest") {
    const question = interaction.options.getString("question", true);

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    if (!config?.qotdModChannelId) {
      await interaction.editReply(
        "A staff member needs to set up the QOTD mod channel first using `/setup qotd-channel`."
      );
      return;
    }

    const [inserted] = await db
      .insert(qotdSuggestions)
      .values({
        guildId: interaction.guildId,
        submittedBy: interaction.user.username,
        question,
      })
      .returning();

    const channel = await interaction.client.channels.fetch(config.qotdModChannelId);
    if (channel && channel.type === ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setColor(0xc8e6c9)
        .setTitle("💬 New QOTD Suggestion")
        .setDescription(`**${question}**`)
        .addFields(
          { name: "Suggestion ID", value: `#${inserted.id}`, inline: true },
          { name: "Action", value: `\`/qotd use ${inserted.id}\``, inline: true }
        )
        .setFooter({ text: `Submitted by ${interaction.user.username} · Garden of Harmony` })
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    }

    await interaction.editReply("Your question has been sent to the mods for review. Thank you! 🌸");
    return;
  }

  // Mod-only subcommands
  const isMod = interaction.memberPermissions?.has("ManageGuild");
  if (!isMod) {
    await interaction.editReply("Only staff members can use this command. 🍃");
    return;
  }

  if (sub === "list") {
    const pending = await db
      .select()
      .from(qotdSuggestions)
      .where(and(eq(qotdSuggestions.guildId, interaction.guildId), eq(qotdSuggestions.used, false)));

    if (pending.length === 0) {
      await interaction.editReply("No pending QOTD suggestions right now. 🌿");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle("🌸 Pending QOTD Suggestions")
      .setDescription(
        pending
          .map((q) => `**#${q.id}** — ${q.question}\n*by ${q.submittedBy}*`)
          .join("\n\n")
      )
      .setFooter({ text: "Use /qotd use <id> to post · Garden of Harmony" });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "use") {
    const id = interaction.options.getInteger("id", true);

    const [qotd] = await db
      .select()
      .from(qotdSuggestions)
      .where(and(eq(qotdSuggestions.id, id), eq(qotdSuggestions.guildId, interaction.guildId)));

    if (!qotd) {
      await interaction.editReply("Could not find that QOTD suggestion.");
      return;
    }

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    // Prefer the public post channel; fall back to mod channel
    const channelId = config?.qotdPostChannelId ?? config?.qotdModChannelId;
    if (!channelId) {
      await interaction.editReply("No QOTD channel configured. Use `/setup qotd-channel` first.");
      return;
    }

    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Could not find the QOTD channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x66bb6a)
      .setTitle("🌸 Question of the Day")
      .setDescription(`**${qotd.question}**`)
      .setFooter({ text: "Garden of Harmony · Share your thoughts below! 🍃" })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
    await db.update(qotdSuggestions).set({ used: true }).where(eq(qotdSuggestions.id, id));
    await interaction.editReply(`QOTD **#${id}** has been posted to <#${channelId}>! 🌿`);
  }
}
