import { Client, Events, GuildMember, EmbedBuilder, TextChannel, ChannelType } from "discord.js";
import { db, guildConfig } from "../lib/database";
import { eq } from "drizzle-orm";

export default function registerGuildMemberAddEvent(client: Client) {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      const [config] = await db
        .select()
        .from(guildConfig)
        .where(eq(guildConfig.guildId, member.guild.id));

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x81c784)
        .setTitle("✨ Welcome to the Garden of Harmony!")
        .setDescription(
          `Hello, **${member.user.username}**! 🌸\n\nMy name is **Faye**, the guardian spirit of this garden. I'm so glad you found your way here.\n\n` +
          `Here are a few things to help you settle in:\n` +
          `🌿 **Introduce yourself** in our introductions channel — we'd love to know you\n` +
          `🎀 **Grab some roles** to customize your experience\n` +
          `🌻 **Say hello** in the general chat — everyone here is friendly!\n\n` +
          `If you ever need help, our wonderful staff team is always here. This garden grows with every soul who joins it. Welcome home. 💚`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: "Garden of Harmony · Faye, guardian spirit 🍃" })
        .setTimestamp();

      try {
        await member.send({ embeds: [welcomeEmbed] });
      } catch {
        // DMs closed — try welcome channel if configured
      }

      if (config?.welcomeChannelId) {
        const channel = await client.channels.fetch(config.welcomeChannelId);
        if (channel && channel.type === ChannelType.GuildText) {
          const textChannel = channel as TextChannel;
          await textChannel.send({
            content: `Welcome to the garden, <@${member.user.id}>! 🌸`,
            embeds: [welcomeEmbed],
          });
        }
      }
    } catch (err) {
      console.error("Error handling guildMemberAdd:", err);
    }
  });
}
