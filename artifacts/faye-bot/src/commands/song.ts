import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { SONG_MOODS, isSongMood, jamDay } from "../lib/jamRoomCatalog";
import { getJamRoom, postSong } from "../lib/jamRoomSongs";

export const data = new SlashCommandBuilder()
  .setName("song")
  .setDescription("Let today's Garden sister choose your soundtrack")
  .setDMPermission(false)
  .addSubcommand(s => s.setName("suggestion").setDescription("Get a Spotify song for your mood from today's sister")
    .addStringOption(o => o.setName("mood").setDescription("What are you in the mood for?")
      .setRequired(true).addChoices(...SONG_MOODS)));

const cooldowns = new Map<string, number>();
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || interaction.guildId !== process.env.DISCORD_GUILD_ID?.trim()) {
    await interaction.reply({ content: "Song suggestions are available in Garden of Harmony.", ephemeral: true });
    return;
  }
  const mood = interaction.options.getString("mood", true);
  if (!isSongMood(mood)) return;
  const key = `${interaction.guildId}:${interaction.user.id}`;
  if ((cooldowns.get(key) ?? 0) > Date.now()) {
    await interaction.reply({ content: "Give the playlist a moment! You can request another song in 30 seconds. 🎶", ephemeral: true });
    return;
  }
  // Acknowledge promptly while Discord resolves the channel and permissions.
  await interaction.deferReply({ ephemeral: true });
  const channel = await getJamRoom(interaction.guild);
  if (interaction.channelId !== channel.id) {
    await interaction.editReply(`Use **/song suggestion** in <#${channel.id}>. 🎶`);
    return;
  }
  cooldowns.set(key, Date.now() + 30_000);
  // Keep the bounded, per-user spam guard from accumulating inactive members.
  for (const [id, until] of cooldowns) if (until <= Date.now()) cooldowns.delete(id);
  const day = jamDay();
  const sister = day.sister === "faye" ? "Faye" : "Lilith";
  const label = SONG_MOODS.find(m => m.value === mood)!.name;
  const request = await channel.send({
    embeds: [new EmbedBuilder().setTitle("🎶 Song suggestion")
      .setDescription(`**${sister}’s turn!** A song request from <@${interaction.user.id}>.`)
      .addFields({ name: "Mood", value: label })
      .setFooter({ text: `${sister}’s turn • ${day.date}` })
      .setColor(day.sister === "faye" ? 0x7cae85 : 0x9468b8)],
    allowedMentions: { parse: [] },
  });
  if (day.sister === "faye") {
    const song = await postSong(interaction.guild, `request:${request.id}`, mood, request.id);
    await interaction.editReply(song ? `🌿 Your song is in <#${channel.id}>!` : "The sisters just changed shifts. Please request your song again.");
  } else {
    await interaction.editReply(`🌙 Sent your ${label} request to Lilith in <#${channel.id}>.`);
  }
}
