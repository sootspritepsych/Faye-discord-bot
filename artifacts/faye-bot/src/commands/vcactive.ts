import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { pool } from "../lib/database";

export const data = new SlashCommandBuilder()
  .setName("vcactive")
  .setDescription("Shows today's voice activity for a voice channel")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Voice channel")
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.options.getChannel("channel");

  if (!channel) {
    await interaction.reply({
      content: "Please select a voice channel.",
      ephemeral: true,
    });
    return;
  }

  const result = await pool.query(
    `
    SELECT
      user_id,
      SUM(duration_seconds) AS total_seconds
    FROM voice_sessions
    WHERE guild_id = $1
      AND channel_id = $2
      AND DATE(joined_at) = CURRENT_DATE
    GROUP BY user_id
    ORDER BY total_seconds DESC
    `,
    [interaction.guildId, channel.id]
  );

  if (result.rows.length === 0) {
    await interaction.reply(
      `No voice activity found today for <#${channel.id}>.`
    );
    return;
  }

  let output = `🎤 Voice Activity Today\n<#${channel.id}>\n\n`;

  for (const row of result.rows) {
    const seconds = Number(row.total_seconds || 0);

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    output += `<@${row.user_id}> — ${hours}h ${minutes}m\n`;
  }

  await interaction.reply(output);
}
