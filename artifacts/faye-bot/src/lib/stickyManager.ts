import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { db, stickyMessages } from "./database";
import { eq } from "drizzle-orm";

export async function updateStickyMessage(
  client: Client,
  channelId: string
) {
  try {
    const [sticky] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, channelId));

    if (!sticky) return;

    const channel = await client.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) return;

    const textChannel = channel as TextChannel;

    // Delete previous sticky
    if (sticky.lastMessageId) {
      try {
        const oldMessage = await textChannel.messages.fetch(
          sticky.lastMessageId
        );

        if (oldMessage) {
          await oldMessage.delete();
        }
      } catch {
        // Message already deleted
      }
    }

    // Convert literal "\n" into real line breaks
    const formattedContent = sticky.content
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n");

    const embed = new EmbedBuilder()
      .setDescription(formattedContent)
      .setColor(0x4caf50)
      .setFooter({
        text: "📌 Pinned by Faye · Garden of Harmony",
      });

    const newMessage = await textChannel.send({
      embeds: [embed],
    });

    await db
      .update(stickyMessages)
      .set({
        lastMessageId: newMessage.id,
      })
      .where(eq(stickyMessages.channelId, channelId));

    console.log(
      `Sticky updated in #${textChannel.name} (${textChannel.id})`
    );
  } catch (err) {
    console.error("Error updating sticky message:", err);
  }
}
