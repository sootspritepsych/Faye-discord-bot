import { Client, Events, ChannelType, PermissionFlagsBits, type MessageReaction, type User } from "discord.js";
import { trackGardenReaction } from "../lib/gardenService";

/** Reactions GIVEN by a member count; reactions received do not. */
export default function registerGardenReactionEvent(client: Client): void {
  client.on(Events.MessageReactionAdd, async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;
    try {
      if (reaction.partial) reaction = await reaction.fetch();
      const message = reaction.message.partial
        ? await reaction.message.fetch()
        : reaction.message;
      const guildId = message.guildId;
      if (!guildId || !message.author || !message.guild) return;
      if (message.author.id === user.id) return; // no self reactions
      if (message.channel.type === ChannelType.PrivateThread) return;
      if ("nsfw" in message.channel && message.channel.nsfw === true) return;
      if (!("permissionsFor" in message.channel) ||
          !message.channel.permissionsFor(message.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
        return; // Never surface private or adults-only activity in public rankings.
      }
      await trackGardenReaction(guildId, user.id, message.id);
    } catch (error) {
      console.error("🌳 Garden reaction tracking error:", error);
    }
  });
}
