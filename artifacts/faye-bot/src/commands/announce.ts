import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  Role,
} from "discord.js";

const STAFF_ROLE_ID = "1351498500742971447";

const COLORS = {
  green: 0x77b255,
  purple: 0x9b59b6,
  pink: 0xff9ad5,
  blue: 0x3498db,
  gold: 0xf1c40f,
};

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Post a pretty announcement as Faye")
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Where should Faye post?")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("title")
      .setDescription("Announcement title")
      .setRequired(true)
      .setMaxLength(256)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("Announcement message")
      .setRequired(true)
      .setMaxLength(4000)
  )
  .addStringOption((opt) =>
    opt
      .setName("color")
      .setDescription("Embed color")
      .setRequired(false)
      .addChoices(
        { name: "Green", value: "green" },
        { name: "Purple", value: "purple" },
        { name: "Pink", value: "pink" },
        { name: "Blue", value: "blue" },
        { name: "Gold", value: "gold" }
      )
  )
  .addAttachmentOption((opt) =>
    opt
      .setName("image")
      .setDescription("Optional image for the announcement")
      .setRequired(false)
  )
  .addRoleOption((opt) =>
    opt
      .setName("ping")
      .setDescription("Optional role to ping")
      .setRequired(false)
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
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description", true);
  const colorChoice = interaction.options.getString("color") ?? "green";
  const image = interaction.options.getAttachment("image");
  const pingRole = interaction.options.getRole("ping") as Role | null;

  if (image && !image.contentType?.startsWith("image/")) {
    await interaction.reply({
      content: "Please upload an image file.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🌿 ${title}`)
    .setDescription(description)
    .setColor(COLORS[colorChoice as keyof typeof COLORS])
    .setFooter({
      text: "Garden of Harmony",
    })
    .setTimestamp();

  if (image) {
    embed.setImage(image.url);
  }

  const content = pingRole ? `${pingRole}` : "";

  await channel.send({
    content,
    embeds: [embed],
    allowedMentions: pingRole
      ? { roles: [pingRole.id] }
      : { parse: [] },
  });

  await interaction.reply({
    content: `Announcement posted in ${channel}.`,
    ephemeral: true,
  });
}
