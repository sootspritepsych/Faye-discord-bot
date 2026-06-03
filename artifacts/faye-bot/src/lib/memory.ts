import { db, conversationHistory } from "./database";
import { desc, eq } from "drizzle-orm";

export type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function saveConversationMessage(
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

export async function getRecentConversation(
  channelId: string,
  limit = 10
): Promise<MemoryMessage[]> {
  try {
    const rows = await db
      .select()
      .from(conversationHistory)
      .where(eq(conversationHistory.channelId, channelId))
      .orderBy(desc(conversationHistory.createdAt))
      .limit(limit);

    return rows.reverse().map((row) => ({
      role: row.role as "user" | "assistant",
      content:
        row.role === "user"
          ? `${row.username}: ${row.content}`
          : row.content,
    }));
  } catch (err) {
    console.error("Memory lookup failed:", err);
    return [];
  }
}
