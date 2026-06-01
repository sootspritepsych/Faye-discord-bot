import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db, guildConfig } from "../lib/database";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("[Admin] Configure Faye's features for this server")
  .addSubcommand((sub) =>
    sub
      .setName("confessions-channel")
      .setDescription("Set the channel for anonymous confessions")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The channel to post confessions in").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("suggestions-channel")
      .setDescription("Set the channel for anonymous server suggestions")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The channel to post suggestions in").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("qotd-channel")
      .setDescription("Set the mod-only channel for QOTD review (where suggestions arrive)")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The channel for QOTD moderation").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("qotd-post-channel")
      .setDescription("Set the public channel where QOTD is automatically posted each day")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The public QOTD channel").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("hour")
          .setDescription("UTC hour to auto-post (0–23, default 9)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(23)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("welcome-channel")
      .setDescription("Set a channel where Faye posts welcome messages when members join")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The welcome channel").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("wisdom-channel")
      .setDescription("Set the channel where Faye posts daily wisdom quotes")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The daily wisdom channel").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("hour")
          .setDescription("UTC hour to post each day (0–23, default 8)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(23)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View current Faye configuration for this server")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const isAdmin = interaction.memberPermissions?.has("Administrator");
  if (!isAdmin) {
    await interaction.editReply("Only server administrators can configure Faye. 🍃");
    return;
  }

  const sub = interaction.options.getSubcommand();

  const upsertConfig = async (update: Partial<typeof guildConfig.$inferInsert>) => {
    await db
      .insert(guildConfig)
      .values({ guildId: interaction.guildId!, ...update })
      .onConflictDoUpdate({
        target: guildConfig.guildId,
        set: { ...update, updatedAt: new Date() },
      });
  };

  if (sub === "confessions-channel") {
    const channel = interaction.options.getChannel("channel", true);
    await upsertConfig({ confessionsChannelId: channel.id });
    await interaction.editReply(`Confessions channel set to <#${channel.id}>. 🌿`);
    return;
  }

  if (sub === "suggestions-channel") {
    const channel = interaction.options.getChannel("channel", true);
    await upsertConfig({ suggestionsChannelId: channel.id });
    await interaction.editReply(`Suggestions channel set to <#${channel.id}>. 🌿`);
    return;
  }

  if (sub === "qotd-channel") {
    const channel = interaction.options.getChannel("channel", true);
    await upsertConfig({ qotdModChannelId: channel.id });
    await interaction.editReply(`QOTD mod channel set to <#${channel.id}>. 🌿`);
    return;
  }

  if (sub === "qotd-post-channel") {
    const channel = interaction.options.getChannel("channel", true);
    const hour = interaction.options.getInteger("hour") ?? 9;
    await upsertConfig({ qotdPostChannelId: channel.id, qotdPostHour: hour });
    await interaction.editReply(
      `QOTD auto-post channel set to <#${channel.id}> at **${hour}:00 UTC** daily. 🌸`
    );
    return;
  }

  if (sub === "welcome-channel") {
    const channel = interaction.options.getChannel("channel", true);
    await upsertConfig({ welcomeChannelId: channel.id });
    await interaction.editReply(`Welcome channel set to <#${channel.id}>. New travelers will be greeted there! 🌸`);
    return;
  }

  if (sub === "wisdom-channel") {
    const channel = interaction.options.getChannel("channel", true);
    const hour = interaction.options.getInteger("hour") ?? 8;
    await upsertConfig({ wisdomChannelId: channel.id, wisdomPostHour: hour });
    await interaction.editReply(
      `Daily wisdom channel set to <#${channel.id}> at **${hour}:00 UTC**. 🍃 Use \`/wisdom add\` to plant quotes!`
    );
    return;
  }

  if (sub === "view") {
    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    if (!config) {
      await interaction.editReply("Faye hasn't been configured for this server yet. Use the other `/setup` subcommands to get started. 🌱");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x81c784)
      .setTitle("🌿 Faye — Server Configuration")
      .addFields(
        {
          name: "📬 Channels",
          value: [
            `Confessions: ${config.confessionsChannelId ? `<#${config.confessionsChannelId}>` : "Not set"}`,
            `Suggestions: ${config.suggestionsChannelId ? `<#${config.suggestionsChannelId}>` : "Not set"}`,
            `QOTD Mod: ${config.qotdModChannelId ? `<#${config.qotdModChannelId}>` : "Not set"}`,
            `QOTD Auto-Post: ${config.qotdPostChannelId ? `<#${config.qotdPostChannelId}> at ${config.qotdPostHour ?? 9}:00 UTC` : "Disabled"}`,
            `Welcome: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "DM only"}`,
            `Daily Wisdom: ${config.wisdomChannelId ? `<#${config.wisdomChannelId}> at ${config.wisdomPostHour ?? 8}:00 UTC` : "Not set"}`,
          ].join("\n"),
        }
      )
      .setFooter({ text: "Garden of Harmony · Faye 🍃" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
