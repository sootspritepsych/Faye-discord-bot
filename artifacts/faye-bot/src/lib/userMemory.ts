import { db, userMemories } from "./database";
import { desc, eq } from "drizzle-orm";

export async function saveUserMemory(
  userId: string,
  username: string,
  memory: string
) {
  try {
    await db.insert(userMemories).values({
      userId,
      username,
      memory,
    });

    console.log(
      `🧠 Saved memory for ${username}: ${memory}`
    );
  } catch (err) {
    console.error("Failed to save user memory:", err);
  }
}

export async function getUserMemories(
  userId: string,
  limit = 10
): Promise<string[]> {
  try {
    const rows = await db
      .select()
      .from(userMemories)
      .where(eq(userMemories.userId, userId))
      .orderBy(desc(userMemories.createdAt))
      .limit(limit);

    return rows
      .reverse()
      .map((row) => row.memory);
  } catch (err) {
    console.error("Failed to retrieve user memories:", err);
    return [];
  }
}

export async function deleteUserMemory(
  userId: string,
  memoryText: string
) {
  try {
    const memories = await db
      .select()
      .from(userMemories)
      .where(eq(userMemories.userId, userId));

    const target = memories.find(
      (m) =>
        m.memory.toLowerCase() ===
        memoryText.toLowerCase()
    );

    if (!target) {
      return false;
    }

    await db
      .delete(userMemories)
      .where(eq(userMemories.id, target.id));

    return true;
  } catch (err) {
    console.error("Failed to delete memory:", err);
    return false;
  }
}

export async function getMemorySummary(
  userId: string
): Promise<string> {
  try {
    const memories = await getUserMemories(userId);

    if (!memories.length) {
      return "I don't remember anything specific yet.";
    }

    return memories.map((m) => `• ${m}`).join("\n");
  } catch (err) {
    console.error("Failed to generate memory summary:", err);
    return "I couldn't recall my memories right now.";
  }
}
