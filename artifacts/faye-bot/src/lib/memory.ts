import {
  desc,
  eq,
} from "drizzle-orm";

import {
  conversationHistory,
  db,
} from "./database";

export type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function saveConversationMessage(
  conversationKey: string,
  userId: string,
  username: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const cleanedContent =
    content.trim();

  if (!cleanedContent) {
    return;
  }

  try {
    await db
      .insert(conversationHistory)
      .values({
        /*
         * The existing channelId database field now
         * stores a conversation key.
         *
         * Examples:
         * faye:dm:user:123456789012345678
         * faye:guild:123:channel:456
         */
        channelId: conversationKey,
        userId,
        username,
        role,
        content: cleanedContent,
      });
  } catch (error) {
    console.error(
      "Memory save failed:",
      error
    );
  }
}

export async function getRecentConversation(
  conversationKey: string,
  limit = 10
): Promise<MemoryMessage[]> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(limit),
        1
      ),
      50
    );

  try {
    const rows =
      await db
        .select()
        .from(conversationHistory)
        .where(
          eq(
            conversationHistory.channelId,
            conversationKey
          )
        )
        .orderBy(
          desc(
            conversationHistory.createdAt
          )
        )
        .limit(safeLimit);

    /*
     * The database returns newest messages first.
     * Reverse them before sending them to OpenAI so
     * the conversation appears in normal chronological
     * order.
     */
    return rows
      .reverse()
      .map((row) => ({
        role:
          row.role as
            | "user"
            | "assistant",
        content:
          row.role === "user"
            ? `${row.username}: ${row.content}`
            : row.content,
      }));
  } catch (error) {
    console.error(
      "Memory lookup failed:",
      error
    );

    return [];
  }
}