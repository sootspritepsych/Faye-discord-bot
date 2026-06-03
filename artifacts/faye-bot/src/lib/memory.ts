import { db, conversationHistory } from "./database";
import { desc, eq } from "drizzle-orm";

export async function saveMemory(
  channelId: string,
  userId: string,
  username: string,
  role: "user" | "assistant",
  content: string
) {
  try {
    await db.insert(conversationHistory).values({
      channelId,
      userId,
      username,
      role,
      content,
    });
  } catch (err) {
    console.error("Memory save failed:", err);
  }
}

export async function getRecentMemory(
  channelId: string,
  limit = 10
) {
  try {
    return await db
      .select()
      .from(conversationHistory)
      .where(eq(conversationHistory.channelId, channelId))
      .orderBy(desc(conversationHistory.createdAt))
      .limit(limit);
  } catch (err) {
    console.error("Memory lookup failed:", err);
    return [];
  }
}
