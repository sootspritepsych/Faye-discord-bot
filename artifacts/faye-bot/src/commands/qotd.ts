import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { db, qotdSuggestions, guildConfig } from "../lib/database";
import { eq, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("qotd")
  .setDescription("Question of the Day commands")
  .addSubcommand((sub) =>
    sub
      .setName("suggest")
      .setDescription("Suggest a question of the day for the mods to review")
      .addStringOption((opt) =>
        opt
          .setName("question")
          .setDescription("Your QOTD question")
          .setRequired(true)
          .setMaxLength(500)
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
        opt
          .setName("id")
          .setDescription("The ID of the QOTD suggestion to post")
          .setRequired(true)
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

    const submittedBy = `${interaction.user.username} (${interaction.user.id})`;

    const [inserted] = await db
      .insert(qotdSuggestions)
      .values({
        guildId: interaction.guildId,
        submittedBy,
        question,
        used: false,
      })
      .returning();

    const channel = await interaction.client.channels.fetch(
      config.qotdModChannelId
    );

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply(
        "Your question was saved, but I could not find the staff QOTD channel."
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xc8e6c9)
      .setTitle("💬 New QOTD Suggestion")
      .setDescription(`**${question}**`)
      .addFields(
        { name: "Suggestion ID", value: `#${inserted.id}`, inline: true },
        { name: "Submitted By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Action", value: `/qotd use id:${inserted.id}` }
      )
      .setFooter({
        text: `Submitted by ${interaction.user.username} · Garden of Harmony`,
      })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });

    await interaction.editReply(
      "Your question has been sent to the mods for review. Thank you! 🌸"
    );
    return;
  }

  const isMod = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageGuild
  );

  if (!isMod) {
    await interaction.editReply("Only staff members can use this command. 🍃");
    return;
  }

  if (sub === "list") {
    const pending = await db
      .select()
      .from(qotdSuggestions)
      .where(
        and(
          eq(qotdSuggestions.guildId, interaction.guildId),
          eq(qotdSuggestions.used, false)
        )
      );

    if (pending.length === 0) {
      await interaction.editReply("No pending QOTD suggestions right now. 🌿");
      return;
    }

    const description = pending
      .slice(0, 20)
      .map((q) => `**#${q.id}** — ${q.question}\n*by ${q.submittedBy}*`)
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xa5d6a7)
      .setTitle("🌸 Pending QOTD Suggestions")
      .setDescription(description)
      .setFooter({
        text:
          pending.length > 20
            ? "Showing first 20 suggestions · Use /qotd use id:<id> to post"
            : "Use /qotd use id:<id> to post · Garden of Harmony",
      });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "use") {
    const id = interaction.options.getInteger("id", true);

    const [qotd] = await db
      .select()
      .from(qotdSuggestions)
      .where(
        and(
          eq(qotdSuggestions.id, id),
          eq(qotdSuggestions.guildId, interaction.guildId)
        )
      );

    if (!qotd) {
      await interaction.editReply("Could not find that QOTD suggestion.");
      return;
    }

    if (qotd.used) {
      await interaction.editReply("That QOTD suggestion has already been used.");
      return;
    }

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    const channelId = config?.qotdPostChannelId;

    if (!channelId) {
      await interaction.editReply(
        "No public QOTD post channel is configured. Please set one first."
      );
      return;
    }

    const channel = await interaction.client.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Could not find the public QOTD channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x66bb6a)
      .setTitle("🌸 Question of the Day")
      .setDescription(`**${qotd.question}**`)
      .setFooter({
        text: "Garden of Harmony · Share your thoughts below! 🍃",
      })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });

    await db
      .update(qotdSuggestions)
      .set({ used: true })
      .where(eq(qotdSuggestions.id, id));

    await interaction.editReply(
      `QOTD **#${id}** has been posted to <#${channelId}>! 🌿`
    );
  }
}