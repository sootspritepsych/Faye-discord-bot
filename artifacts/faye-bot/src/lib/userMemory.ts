import {
  and,
  desc,
  eq,
  sql,
} from "drizzle-orm";

import {
  db,
  userMemories,
} from "./database";

const DEFAULT_MEMORY_LIMIT = 10;
const MAX_MEMORY_LIMIT = 50;
const MAX_MEMORY_LENGTH = 500;

function cleanMemoryText(
  memory: string
): string {
  return memory
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_MEMORY_LENGTH);
}

function getSafeLimit(
  limit: number
): number {
  return Math.min(
    Math.max(
      Math.floor(limit),
      1
    ),
    MAX_MEMORY_LIMIT
  );
}

export async function saveUserMemory(
  userId: string,
  username: string,
  memory: string
): Promise<boolean> {
  const cleanedUserId =
    userId.trim();

  const cleanedUsername =
    username
      .trim()
      .slice(0, 100) ||
    "Unknown member";

  const cleanedMemory =
    cleanMemoryText(memory);

  if (
    !cleanedUserId ||
    !cleanedMemory
  ) {
    return false;
  }

  try {
    /*
     * Avoid saving the same memory repeatedly.
     *
     * This comparison is case-insensitive, so:
     *
     * "My dog is Peppa"
     * and
     * "my dog is peppa"
     *
     * count as the same saved memory.
     */
    const [existingMemory] =
      await db
        .select({
          id: userMemories.id,
        })
        .from(userMemories)
        .where(
          and(
            eq(
              userMemories.userId,
              cleanedUserId
            ),
            sql`lower(${userMemories.memory}) = lower(${cleanedMemory})`
          )
        )
        .limit(1);

    if (existingMemory) {
      console.log(
        `🧠 Skipped duplicate memory for ${cleanedUsername}: ${cleanedMemory}`
      );

      return false;
    }

    await db
      .insert(userMemories)
      .values({
        userId: cleanedUserId,
        username: cleanedUsername,
        memory: cleanedMemory,
      });

    console.log(
      `🧠 Saved memory for ${cleanedUsername}: ${cleanedMemory}`
    );

    return true;
  } catch (error) {
    console.error(
      "Failed to save user memory:",
      error
    );

    return false;
  }
}

export async function getUserMemories(
  userId: string,
  limit = DEFAULT_MEMORY_LIMIT
): Promise<string[]> {
  const cleanedUserId =
    userId.trim();

  if (!cleanedUserId) {
    return [];
  }

  const safeLimit =
    getSafeLimit(limit);

  try {
    const rows =
      await db
        .select({
          memory: userMemories.memory,
        })
        .from(userMemories)
        .where(
          eq(
            userMemories.userId,
            cleanedUserId
          )
        )
        .orderBy(
          desc(
            userMemories.createdAt
          ),
          desc(
            userMemories.id
          )
        )
        .limit(safeLimit);

    /*
     * PostgreSQL returns newest memories first.
     * Reverse them so Faye receives them in the order
     * the member originally shared them.
     */
    return rows
      .reverse()
      .map(
        (row) =>
          row.memory.trim()
      )
      .filter(Boolean);
  } catch (error) {
    console.error(
      "Failed to retrieve user memories:",
      error
    );

    return [];
  }
}

export async function deleteUserMemory(
  userId: string,
  memoryText: string
): Promise<boolean> {
  const cleanedUserId =
    userId.trim();

  const cleanedMemoryText =
    cleanMemoryText(memoryText);

  if (
    !cleanedUserId ||
    !cleanedMemoryText
  ) {
    return false;
  }

  try {
    const [target] =
      await db
        .select({
          id: userMemories.id,
        })
        .from(userMemories)
        .where(
          and(
            eq(
              userMemories.userId,
              cleanedUserId
            ),
            sql`lower(${userMemories.memory}) = lower(${cleanedMemoryText})`
          )
        )
        .orderBy(
          desc(
            userMemories.createdAt
          ),
          desc(
            userMemories.id
          )
        )
        .limit(1);

    if (!target) {
      return false;
    }

    await db
      .delete(userMemories)
      .where(
        eq(
          userMemories.id,
          target.id
        )
      );

    return true;
  } catch (error) {
    console.error(
      "Failed to delete memory:",
      error
    );

    return false;
  }
}

export async function deleteAllUserMemories(
  userId: string
): Promise<number> {
  const cleanedUserId =
    userId.trim();

  if (!cleanedUserId) {
    return 0;
  }

  try {
    const deletedRows =
      await db
        .delete(userMemories)
        .where(
          eq(
            userMemories.userId,
            cleanedUserId
          )
        )
        .returning({
          id: userMemories.id,
        });

    return deletedRows.length;
  } catch (error) {
    console.error(
      "Failed to delete all user memories:",
      error
    );

    return 0;
  }
}

export async function getMemorySummary(
  userId: string
): Promise<string> {
  try {
    const memories =
      await getUserMemories(
        userId
      );

    if (!memories.length) {
      return "I don't remember anything specific yet.";
    }

    return memories
      .map(
        (memory) =>
          `• ${memory}`
      )
      .join("\n");
  } catch (error) {
    console.error(
      "Failed to generate memory summary:",
      error
    );

    return "I couldn't recall my memories right now.";
  }
}