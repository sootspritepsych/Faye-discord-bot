import {
  and,
  eq,
  sql,
} from "drizzle-orm";

import {
  db,
  fayeMemberRapport,
} from "./database";

export type FayeRapportLevel =
  | "new_traveler"
  | "familiar_gardener"
  | "garden_regular"
  | "trusted_companion"
  | "beloved_grovekeeper";

export interface FayeRapportContext {
  interactionCount: number;
  level: FayeRapportLevel;
  firstInteractionAt: Date;
  previousInteractionAt: Date | null;
  daysSincePreviousInteraction: number | null;
  isReturningAfterAbsence: boolean;
}

const RETURNING_AFTER_DAYS = 4;

function cleanUsername(
  username: string
): string {
  const cleaned = username
    .trim()
    .slice(0, 100);

  return cleaned || "Unknown member";
}

export function getFayeRapportLevel(
  interactionCount: number
): FayeRapportLevel {
  if (interactionCount >= 75) {
    return "beloved_grovekeeper";
  }

  if (interactionCount >= 35) {
    return "trusted_companion";
  }

  if (interactionCount >= 15) {
    return "garden_regular";
  }

  if (interactionCount >= 4) {
    return "familiar_gardener";
  }

  return "new_traveler";
}

function calculateDaysSince(
  previousDate: Date,
  currentDate: Date
): number {
  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return Math.floor(
    (
      currentDate.getTime() -
      previousDate.getTime()
    ) / millisecondsPerDay
  );
}

export async function recordFayeInteraction(
  guildId: string,
  userId: string,
  username: string
): Promise<FayeRapportContext> {
  const now = new Date();

  const existingRows = await db
    .select({
      interactionCount:
        fayeMemberRapport.interactionCount,

      firstInteractionAt:
        fayeMemberRapport.firstInteractionAt,

      lastInteractionAt:
        fayeMemberRapport.lastInteractionAt,
    })
    .from(fayeMemberRapport)
    .where(
      and(
        eq(
          fayeMemberRapport.guildId,
          guildId
        ),
        eq(
          fayeMemberRapport.userId,
          userId
        )
      )
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    await db
      .insert(fayeMemberRapport)
      .values({
        guildId,
        userId,
        username: cleanUsername(username),
        interactionCount: 1,
        firstInteractionAt: now,
        lastInteractionAt: now,
        updatedAt: now,
      });

    return {
      interactionCount: 1,
      level: "new_traveler",
      firstInteractionAt: now,
      previousInteractionAt: null,
      daysSincePreviousInteraction: null,
      isReturningAfterAbsence: false,
    };
  }

  const nextInteractionCount =
    existing.interactionCount + 1;

  const daysSincePreviousInteraction =
    calculateDaysSince(
      existing.lastInteractionAt,
      now
    );

  await db
    .update(fayeMemberRapport)
    .set({
      username: cleanUsername(username),

      interactionCount: sql`
        ${fayeMemberRapport.interactionCount} + 1
      `,

      lastInteractionAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          fayeMemberRapport.guildId,
          guildId
        ),
        eq(
          fayeMemberRapport.userId,
          userId
        )
      )
    );

  return {
    interactionCount:
      nextInteractionCount,

    level: getFayeRapportLevel(
      nextInteractionCount
    ),

    firstInteractionAt:
      existing.firstInteractionAt,

    previousInteractionAt:
      existing.lastInteractionAt,

    daysSincePreviousInteraction,

    isReturningAfterAbsence:
      daysSincePreviousInteraction >=
      RETURNING_AFTER_DAYS,
  };
}

export function formatFayeRapportContext(
  rapport: FayeRapportContext
): string {
  const lines = [
    `Rapport level: ${rapport.level}`,
    `Recorded interactions: ${rapport.interactionCount}`,
  ];

  if (
    rapport.isReturningAfterAbsence &&
    rapport.daysSincePreviousInteraction !==
      null
  ) {
    lines.push(
      `The member is returning after approximately ${rapport.daysSincePreviousInteraction} days away.`
    );
  }

  switch (rapport.level) {
    case "new_traveler":
      lines.push(
        "Faye does not know this member well yet. Be welcoming and interested without acting overly familiar."
      );
      break;

    case "familiar_gardener":
      lines.push(
        "Faye recognizes this member and may sound more comfortable, warm, and lightly playful."
      );
      break;

    case "garden_regular":
      lines.push(
        "This member is a Garden regular. Faye may use familiar warmth and naturally reference relevant memories or established jokes."
      );
      break;

    case "trusted_companion":
      lines.push(
        "This member is a trusted companion. Faye may show clear fondness, comfortable humor, and sincere protectiveness."
      );
      break;

    case "beloved_grovekeeper":
      lines.push(
        "This member is a beloved grovekeeper. Faye may speak with deep familiarity, affectionate teasing, and steady warmth without becoming possessive."
      );
      break;
  }

  if (rapport.isReturningAfterAbsence) {
    lines.push(
      "Faye may briefly express happiness that they are back, but must not imply that she tracked or monitored their absence."
    );
  }

  return lines.join("\n");
}
