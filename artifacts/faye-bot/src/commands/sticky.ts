import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { db, stickyMessages } from "../lib/database";
import { eq } from "drizzle-orm";
import { updateStickyMessage } from "../lib/stickyManager";

function formatStickyContent(content: string) {
  return content
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

export const data = new SlashCommandBuilder()
  .setName("sticky")
  .setDescription("Manage sticky messages in a channel")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("[Mod] Set or update the sticky message for the current channel")
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Use \\n for line breaks")
          .setRequired(true)
          .setMaxLength(1500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("[Mod] Remove the sticky message from the current channel")
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View the current sticky message in this channel")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();

  if (sub === "set" || sub === "remove") {
    const isAdmin = interaction.memberPermissions?.has("ManageMessages");

    if (!isAdmin) {
      await interaction.editReply(
        "Only staff members with Manage Messages permission can set sticky messages. 🍃"
      );
      return;
    }
  }

if (sub === "set") {
  const rawContent = interaction.options.getString("message", true);
  const content = formatStickyContent(rawContent);

  console.log("🌿 STICKY SET COMMAND RUNNING");
  console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);
  console.log("Channel ID:", interaction.channelId);
  console.log("Content preview:", content.slice(0, 100));

  try {
    const saved = await db
      .insert(stickyMessages)
      .values({
        channelId: interaction.channelId,
        content,
        lastMessageId: null,
      })
      .onConflictDoUpdate({
        target: stickyMessages.channelId,
        set: {
          content,
          lastMessageId: null,
        },
      })
      .onConflictDoUpdate({
  target: stickyMessages.channelId,
  set: {
    content,
    lastMessageId: null,
    updatedAt: new Date(),
  },
});
      .returning();

    console.log("✅ Sticky saved to DB:", saved);
  } catch (error) {
    console.error("❌ Sticky DB save failed:", error);

    await interaction.editReply(
      "Sticky message could not be saved to the database. Check Railway logs. ❌"
    );
    return;
  }

  await updateStickyMessage(interaction.client, interaction.channelId);

  await interaction.editReply(
    "🌿 DEBUG sticky command ran and attempted DB save."
  );
  return;
}

  if (sub === "remove") {
    const [existing] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, interaction.channelId));

    if (!existing) {
      await interaction.editReply("There is no sticky message in this channel.");
      return;
    }

    if (existing.lastMessageId) {
      try {
        const ch = await interaction.client.channels.fetch(interaction.channelId);

        if (ch?.isTextBased() && "messages" in ch) {
          const msg = await ch.messages.fetch(existing.lastMessageId);
          await msg.delete();
        }
      } catch {
        // already gone
      }
    }

    await db
      .delete(stickyMessages)
      .where(eq(stickyMessages.channelId, interaction.channelId));

    await interaction.editReply("Sticky message removed. 🍃");
    return;
  }

  if (sub === "view") {
    const [existing] = await db
      .select()
      .from(stickyMessages)
      .where(eq(stickyMessages.channelId, interaction.channelId));

    if (!existing) {
      await interaction.editReply("No sticky message is set in this channel.");
      return;
    }

    await interaction.editReply(
      `**Current sticky message:**\n\n${formatStickyContent(existing.content)}`
    );
  }
}
