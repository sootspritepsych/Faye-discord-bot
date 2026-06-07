import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";

const STAFF_ROLE_ID = "1351498500742971447";

export const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Send a message as Faye")
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Where should Faye post?")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("What should Faye say?")
      .setRequired(true)
      .setMaxLength(2000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  if (!interaction.member || !("roles" in interaction.member)) {
    await interaction.reply({
      content: "Unable to verify your staff role.",
      ephemeral: true,
    });
    return;
  }

  const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);

  if (!hasStaffRole) {
    await interaction.reply({
      content: "Only staff members can use this command.",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const message = interaction.options.getString("message", true);

  await channel.send(message);

  await interaction.reply({
    content: `Sent to ${channel}.`,
    ephemeral: true,
  });
}
