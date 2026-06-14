import { Client, VoiceState } from "discord.js";
import { query } from "../lib/database";

const TRACKED_VOICE_CHANNEL_ID = process.env.TRACKED_VOICE_CHANNEL_ID;

export default function registerVoiceStateUpdateEvent(client: Client) {
  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    try {
      if (!TRACKED_VOICE_CHANNEL_ID) return;

      const userId = newState.id;
      const guildId = newState.guild.id;

      const wasInTracked = oldState.channelId === TRACKED_VOICE_CHANNEL_ID;
      const isInTracked = newState.channelId === TRACKED_VOICE_CHANNEL_ID;

      if (!wasInTracked && isInTracked) {
        await query(
          `INSERT INTO voice_sessions 
           (guild_id, user_id, channel_id, joined_at)
           VALUES ($1, $2, $3, NOW())`,
          [guildId, userId, TRACKED_VOICE_CHANNEL_ID]
        );
      }

      if (wasInTracked && !isInTracked) {
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
          [guildId, userId, TRACKED_VOICE_CHANNEL_ID]
        );
      }
    } catch (err) {
      console.error("Error tracking voice state:", err);
    }
  });
}
