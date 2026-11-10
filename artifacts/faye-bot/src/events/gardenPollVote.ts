import { ChannelType, PermissionFlagsBits, type Client } from "discord.js";
import { recordDailyPollVote } from "../lib/gardenService";

/** Raw gateway event works even when Faye restarted after the native poll was
 * posted (and therefore the poll message is no longer in her cache).
 * The database verifies this is today's official Faye daily poll. */
type PollVotePacket = {
  t?: string;
  d?: {
    guild_id?: string;
    channel_id?: string;
    message_id?: string;
    user_id?: string;
    answer_id?: number;
  };
};

export default function registerGardenPollVoteEvent(client: Client): void {
  client.on("raw", (packet: PollVotePacket) => {
    if (packet.t !== "MESSAGE_POLL_VOTE_ADD") return;
    const { guild_id: guildId, channel_id: channelId, message_id: messageId,
      user_id: userId } = packet.d ?? {};
    if (!guildId || !channelId || !messageId || !userId || userId === client.user?.id) return;

    void (async () => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText ||
          !channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) ||
          channel.nsfw) return;
      const voter = await client.users.fetch(userId).catch(() => null);
      if (!voter || voter.bot) return;
      const credited = await recordDailyPollVote(guildId, userId, messageId);
      if (credited) {
        console.log("🗳️ Daily garden poll vote credited:", guildId, userId);
      }
    })().catch(error => console.error("🌳 Garden poll vote tracking error:", error));
  });
}
