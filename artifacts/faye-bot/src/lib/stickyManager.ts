import {
  Client,
  EmbedBuilder,
  TextBasedChannel,
} from "discord.js";
import { db, stickyMessages } from "./database";
import { eq } from "drizzle-orm";

export async function updateStickyMessage(
  client: Client,
  channelId: string
) {
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

    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      console.log("Sticky skipped: channel is not a sendable text channel", channelId);
      return;
    }

    const textChannel = channel as TextBasedChannel & {
      send: Function;
      messages: any;
    };

    if (sticky.lastMessageId) {
      try {
        const oldMessage = await textChannel.messages.fetch(sticky.lastMessageId);
        await oldMessage.delete();
      } catch {
        console.log("Old sticky already deleted or unavailable.");
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

    console.log(`Sticky updated in channel ${channelId}`);
  } catch (err) {
    console.error("Error updating sticky message:", err);
  }
}
