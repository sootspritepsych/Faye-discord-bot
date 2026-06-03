import { db } from "./database";
import { sql } from "drizzle-orm";

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
  await db.execute(sql`
    INSERT INTO conversation_history (channel_id, user_id, username, role, content)
    VALUES (${channelId}, ${userId}, ${username}, ${role}, ${content})
  `);
}

export async function getRecentConversation(channelId: string): Promise<MemoryMessage[]> {
  const result = await db.execute(sql`
    SELECT role, username, content
    FROM conversation_history
    WHERE channel_id = ${channelId}
    ORDER BY created_at DESC
    LIMIT 10
  `);

  return result.rows
    .reverse()
    .map((row: any) => ({
      role: row.role as "user" | "assistant",
      content:
        row.role === "user"
          ? `${row.username}: ${row.content}`
          : row.content,
    }));
}
