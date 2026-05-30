import { Client, TextChannel, ChannelType } from "discord.js";
import { db, stickyMessages } from "./database";
import { eq } from "drizzle-orm";

export async function updateStickyMessage(client: Client, channelId: string) {
  try {
    const [sticky] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, channelId));

    if (!sticky) return;

    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const textChannel = channel as TextChannel;

    if (sticky.lastMessageId) {
      try {
        const oldMsg = await textChannel.messages.fetch(sticky.lastMessageId);
        await oldMsg.delete();
      } catch {
        // message already gone
      }
    }

    const newMsg = await textChannel.send({
      embeds: [
        {
          description: sticky.content,
          color: 0x4caf50,
          footer: { text: "📌 Pinned by Faye · Garden of Harmony" },
        },
      ],
    });

    await db
      .update(stickyMessages)
      .set({ lastMessageId: newMsg.id })
      .where(eq(stickyMessages.channelId, channelId));
  } catch (err) {
    console.error("Error updating sticky message:", err);
  }
}
