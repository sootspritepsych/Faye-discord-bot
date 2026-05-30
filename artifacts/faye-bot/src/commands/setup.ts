import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
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
      .setDescription("Set the mod-only channel for QOTD suggestions and posting")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The channel for QOTD moderation").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("welcome-channel")
      .setDescription("Set a channel where Faye posts welcome messages (in addition to DMs)")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("The welcome channel").setRequired(true)
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

  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isAdmin = member?.permissions.has("Administrator");

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

  if (sub === "welcome-channel") {
    const channel = interaction.options.getChannel("channel", true);
    await upsertConfig({ welcomeChannelId: channel.id });
    await interaction.editReply(`Welcome channel set to <#${channel.id}>. New members will be greeted there! 🌸`);
    return;
  }

  if (sub === "view") {
    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, interaction.guildId));

    if (!config) {
      await interaction.editReply("Faye hasn't been configured for this server yet. Use the other `/setup` subcommands to get started.");
      return;
    }

    const lines = [
      `**Confessions channel:** ${config.confessionsChannelId ? `<#${config.confessionsChannelId}>` : "Not set"}`,
      `**Suggestions channel:** ${config.suggestionsChannelId ? `<#${config.suggestionsChannelId}>` : "Not set"}`,
      `**QOTD mod channel:** ${config.qotdModChannelId ? `<#${config.qotdModChannelId}>` : "Not set"}`,
      `**Welcome channel:** ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set (DM only)"}`,
    ];

    await interaction.editReply(`**Faye Configuration** 🌿\n\n${lines.join("\n")}`);
  }
}
