import { Client, EmbedBuilder, TextBasedChannel } from "discord.js";
import { db, stickyMessages } from "./database";
import { eq } from "drizzle-orm";

type SendableTextChannel = TextBasedChannel & {
  send: (options: any) => Promise<any>;
  messages: {
    fetch: (messageId: string) => Promise<any>;
  };
};

const stickyLocks = new Set<string>();

export async function updateStickyMessage(client: Client, channelId: string) {
  if (stickyLocks.has(channelId)) {
    console.log("Sticky update already running, skipping:", channelId);
    return;
  }

  stickyLocks.add(channelId);

  try {
    console.log("Checking sticky for channel:", channelId);

    const [sticky] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, channelId));

    if (!sticky) {
      console.log("No sticky found for channel:", channelId);
      return;
    }

    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.log("Sticky skipped: channel not found", channelId);
      return;
    }

    if (
      !channel.isTextBased() ||
      !("send" in channel) ||
      !("messages" in channel)
    ) {
      console.log("Sticky skipped: channel is not sendable", channelId);
      return;
    }

    const textChannel = channel as SendableTextChannel;

    if (sticky.lastMessageId) {
      try {
        const oldMessage = await textChannel.messages.fetch(sticky.lastMessageId);
        await oldMessage.delete();
        console.log("Old sticky deleted:", sticky.lastMessageId);
      } catch {
        console.log("Old sticky could not be deleted. Continuing anyway.");
      }
    }

    const formattedContent = sticky.content
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .trim();

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

    console.log("Sticky updated successfully:", newMessage.id);
  } catch (err) {
    console.error("Error updating sticky message:", err);
  } finally {
    stickyLocks.delete(channelId);
  }
}
