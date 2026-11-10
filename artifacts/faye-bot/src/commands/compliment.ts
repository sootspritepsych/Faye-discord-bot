import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { socialText } from "../lib/gardenSocialText";
import { claimSocialUse } from "../lib/gardenSocialStore";

export const complimentCommand = {
  data: new SlashCommandBuilder()
    .setName("compliment")
    .setDescription("Give yourself or a member a warm compliment from Faye")
    .setDMPermission(false)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("Someone to compliment, or leave blank for yourself"),
    )
    .addStringOption((o) =>
      o
        .setName("about")
        .setDescription(
          "Something to celebrate about them (visible context for the compliment)",
        )
        .setMaxLength(200),
    ),
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    if (!i.guildId || !i.guild) {
      await i.reply({
        content: "Visit the server Garden for a compliment. 🌸",
        ephemeral: true,
      });
      return;
    }
    await i.deferReply();
    const target = i.options.getUser("user") ?? i.user;
    const member = await i.guild.members.fetch(target.id).catch(() => null);
    if (!member || target.bot) {
      await i.editReply("Choose a human member of this server. 🌸");
      return;
    }
    if (
      !(await claimSocialUse(i.guildId, i.user.id, "command:compliment", 1, 30))
    ) {
      await i.editReply(
        "Faye is gathering her thoughts. Try again in up to 30 seconds. 🌸",
      );
      return;
    }
    const about = i.options.getString("about");
    const text = await socialText(
      "Faye",
      "Give one sincere, wholesome compliment under 40 words. No appearance comments, flirting, or unsupported personal claims. Use only any supplied celebration detail.",
      JSON.stringify({ displayName: member.displayName, celebrate: about }),
      "You make the Garden a little warmer just by being here. There is something lovely about the space only you can fill. 🌸",
    );
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x77b255)
          .setTitle("🌸 A Compliment from Faye")
          .setDescription(`<@${target.id}>\n\n${text}`),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
