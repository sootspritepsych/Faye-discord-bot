import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, type TextChannel,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, confessions } from "./database";

export interface ConfessionSubmission {
  channel: TextChannel;
  userId: string;
  username: string;
  content: string;
  category?: string;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  Funny: "😄", Personal: "💚", Gaming: "🎮", Secret: "🌙", Random: "🍃",
};

/** The shared submission path for /confess submit and scheduled guardian confessions. */
export async function publishConfession(submission: ConfessionSubmission) {
  const { channel, userId, username } = submission;
  const content = submission.content.trim();
  if (!content || content.length > 1000) throw new Error("Confessions must contain 1–1000 characters.");
  const category = submission.category ?? "Random";
  const emoji = CATEGORY_EMOJIS[category] ?? "🍃";
  const [inserted] = await db.insert(confessions).values({
    guildId: channel.guildId, userId, username, content, category,
  }).returning();

  const title = `${emoji} ${category} Confession #${inserted.id}`;
  const embed = new EmbedBuilder().setColor(0xa5d6a7).setTitle(title)
    .setDescription(content).setFooter({ text: "Anonymous to members · Admins can review · Garden of Harmony 🍃" }).setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`confess-reply_${inserted.id}`)
      .setLabel("💬 Reply Anonymously").setStyle(ButtonStyle.Secondary)
  );
  const canEmbed = channel.permissionsFor(channel.guild.members.me ?? channel.client.user!)
    ?.has(PermissionFlagsBits.EmbedLinks) ?? false;
  const sent = await channel.send({
    ...(canEmbed ? { embeds: [embed] } : {
      content: `**${title}**\n\n${content}\n\nAnonymous to members · Admins can review · Garden of Harmony 🍃`,
    }),
    components: [row],
    allowedMentions: { parse: [] },
  });
  await db.update(confessions).set({ messageId: sent.id }).where(eq(confessions.id, inserted.id));
  return { confessionId: inserted.id, messageId: sent.id };
}
