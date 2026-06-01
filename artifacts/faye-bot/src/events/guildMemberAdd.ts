import { Client, Events, GuildMember, TextChannel, ChannelType } from "discord.js";
import { db, guildConfig, welcomeJourneys } from "../lib/database";
import { eq } from "drizzle-orm";

export default function registerGuildMemberAddEvent(client: Client) {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      const [config] = await db
        .select()
        .from(guildConfig)
        .where(eq(guildConfig.guildId, member.guild.id));

      const dmMessage =
        `🌿 Hello and welcome to **Garden of Harmony**!\n\n` +
        `My name is **Faye**, the guardian spirit of this garden.\n\n` +
        `Feel free to introduce yourself, grab some roles, read the rules, and make yourself at home.\n\n` +
        `If you need help, our staff gardeners are always happy to assist.\n\n` +
        `May your path here be cozy and kind.\n\n` +
        `— Faye ✨`;

      try {
        await member.send(dmMessage);
      } catch {
        // DMs closed — fall through to welcome channel
      }

      if (config?.welcomeChannelId) {
        const channel = await client.channels.fetch(config.welcomeChannelId);
        if (channel && channel.type === ChannelType.GuildText) {
          await (channel as TextChannel).send(
            `🌸 Welcome <@${member.user.id}> to Garden of Harmony.\n\nFaye's lantern has guided a new traveler into the garden.`
          );
        }
      }

      // Record welcome journey for 24h follow-up
      await db.insert(welcomeJourneys).values({
        guildId: member.guild.id,
        userId: member.user.id,
        joinTime: new Date(),
      });
    } catch (err) {
      console.error("Error handling guildMemberAdd:", err);
    }
  });
}
