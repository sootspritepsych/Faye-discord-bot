import { Client, VoiceState } from "discord.js";
import { query } from "../lib/database";

export default function registerVoiceStateUpdateEvent(client: Client) {
  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    try {
      const userId = newState.id;
      const guildId = newState.guild.id;

      const oldChannelId = oldState.channelId;
      const newChannelId = newState.channelId;

      // Joined any voice channel
      if (!oldChannelId && newChannelId) {
        await query(
          `INSERT INTO voice_sessions 
           (guild_id, user_id, channel_id, joined_at)
           VALUES ($1, $2, $3, NOW())`,
          [guildId, userId, newChannelId]
        );
      }

      // Left any voice channel
      if (oldChannelId && !newChannelId) {
        await closeOpenSession(guildId, userId, oldChannelId);
      }

      // Switched voice channels
      if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
        await closeOpenSession(guildId, userId, oldChannelId);

        await query(
          `INSERT INTO voice_sessions 
           (guild_id, user_id, channel_id, joined_at)
           VALUES ($1, $2, $3, NOW())`,
          [guildId, userId, newChannelId]
        );
      }
    } catch (err) {
      console.error("Error tracking voice state:", err);
    }
  });
}

async function closeOpenSession(
  guildId: string,
  userId: string,
  channelId: string
) {
  await query(
    `UPDATE voice_sessions
     SET left_at = NOW(),
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INT
     WHERE id = (
       SELECT id FROM voice_sessions
       WHERE guild_id = $1
         AND user_id = $2
         AND channel_id = $3
         AND left_at IS NULL
       ORDER BY joined_at DESC
       LIMIT 1
     )`,
    [guildId, userId, channelId]
  );
}
