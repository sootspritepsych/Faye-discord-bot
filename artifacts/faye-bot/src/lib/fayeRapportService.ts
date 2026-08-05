import {
  and,
  eq,
  sql,
} from "drizzle-orm";

import {
  db,
  fayeMemberRapport,
} from "./database";

export const FAYE_DM_RAPPORT_SCOPE =
  "faye_private_dms";

export type FayeRapportLevel =
  | "new_traveler"
  | "familiar_gardener"
  | "garden_regular"
  | "trusted_companion"
  | "beloved_grovekeeper";

export type FayeRelationshipType =
  | "server"
  | "dm";

export interface FayeRapportContext {
  interactionCount: number;

  level: FayeRapportLevel;

  relationshipType:
    FayeRelationshipType;

  firstInteractionAt: Date;

  previousInteractionAt:
    Date | null;

  daysSincePreviousInteraction:
    number | null;

  isReturningAfterAbsence:
    boolean;
}

const RETURNING_AFTER_DAYS = 4;

function cleanUsername(
  username: string
): string {
  const cleaned =
    username
      .trim()
      .slice(0, 100);

  return (
    cleaned ||
    "Unknown member"
  );
}

function cleanRelationshipScope(
  scopeId: string
): string {
  const cleaned =
    scopeId
      .trim()
      .slice(0, 200);

  if (!cleaned) {
    throw new Error(
      "Faye rapport scope cannot be empty."
    );
  }

  return cleaned;
}

function cleanUserId(
  userId: string
): string {
  const cleaned =
    userId.trim();

  if (!cleaned) {
    throw new Error(
      "Faye rapport user ID cannot be empty."
    );
  }

  return cleaned;
}

export function getFayeRapportLevel(
  interactionCount: number
): FayeRapportLevel {
  if (interactionCount >= 100) {
    return "beloved_grovekeeper";
  }

  if (interactionCount >= 50) {
    return "trusted_companion";
  }

  if (interactionCount >= 20) {
    return "garden_regular";
  }

  if (interactionCount >= 5) {
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

  const difference =
    currentDate.getTime() -
    previousDate.getTime();

  return Math.max(
    0,
    Math.floor(
      difference /
        millisecondsPerDay
    )
  );
}

function getRelationshipType(
  scopeId: string
): FayeRelationshipType {
  return scopeId ===
    FAYE_DM_RAPPORT_SCOPE
    ? "dm"
    : "server";
}

export async function recordFayeInteraction(
  scopeId: string,
  userId: string,
  username: string
): Promise<FayeRapportContext> {
  const cleanedScopeId =
    cleanRelationshipScope(
      scopeId
    );

  const cleanedUserId =
    cleanUserId(
      userId
    );

  const cleanedUsername =
    cleanUsername(
      username
    );

  const relationshipType =
    getRelationshipType(
      cleanedScopeId
    );

  const now =
    new Date();

  const existingRows =
    await db
      .select({
        interactionCount:
          fayeMemberRapport
            .interactionCount,

        firstInteractionAt:
          fayeMemberRapport
            .firstInteractionAt,

        lastInteractionAt:
          fayeMemberRapport
            .lastInteractionAt,
      })
      .from(
        fayeMemberRapport
      )
      .where(
        and(
          eq(
            fayeMemberRapport
              .guildId,
            cleanedScopeId
          ),
          eq(
            fayeMemberRapport
              .userId,
            cleanedUserId
          )
        )
      )
      .limit(1);

  const existing =
    existingRows[0];

  if (!existing) {
    await db
      .insert(
        fayeMemberRapport
      )
      .values({
        /*
         * The existing guildId column also stores the
         * private-DM relationship scope.
         *
         * Server example:
         * 123456789012345678
         *
         * DM example:
         * faye_private_dms
         */
        guildId:
          cleanedScopeId,

        userId:
          cleanedUserId,

        username:
          cleanedUsername,

        interactionCount: 1,

        firstInteractionAt:
          now,

        lastInteractionAt:
          now,

        updatedAt:
          now,
      });

    return {
      interactionCount: 1,

      level:
        "new_traveler",

      relationshipType,

      firstInteractionAt:
        now,

      previousInteractionAt:
        null,

      daysSincePreviousInteraction:
        null,

      isReturningAfterAbsence:
        false,
    };
  }

  const nextInteractionCount =
    existing.interactionCount +
    1;

  const daysSincePreviousInteraction =
    calculateDaysSince(
      existing.lastInteractionAt,
      now
    );

  await db
    .update(
      fayeMemberRapport
    )
    .set({
      username:
        cleanedUsername,

      interactionCount:
        sql`
          ${fayeMemberRapport.interactionCount} + 1
        `,

      lastInteractionAt:
        now,

      updatedAt:
        now,
    })
    .where(
      and(
        eq(
          fayeMemberRapport
            .guildId,
          cleanedScopeId
        ),
        eq(
          fayeMemberRapport
            .userId,
          cleanedUserId
        )
      )
    );

  return {
    interactionCount:
      nextInteractionCount,

    level:
      getFayeRapportLevel(
        nextInteractionCount
      ),

    relationshipType,

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

export async function recordFayeDmInteraction(
  userId: string,
  username: string
): Promise<FayeRapportContext> {
  return recordFayeInteraction(
    FAYE_DM_RAPPORT_SCOPE,
    userId,
    username
  );
}

export async function recordFayeServerInteraction(
  guildId: string,
  userId: string,
  username: string
): Promise<FayeRapportContext> {
  return recordFayeInteraction(
    guildId,
    userId,
    username
  );
}

function addReturningContext(
  lines: string[],
  rapport: FayeRapportContext
): void {
  if (
    !rapport
      .isReturningAfterAbsence ||
    rapport
      .daysSincePreviousInteraction ===
      null
  ) {
    return;
  }

  lines.push(
    `This person is returning after approximately ${rapport.daysSincePreviousInteraction} days without a recorded conversation.`
  );

  lines.push(
    "Faye may briefly sound pleased to hear from them again, but she must not imply that she watched, tracked, waited for, or was harmed by their absence."
  );
}

function addServerRelationshipContext(
  lines: string[],
  rapport: FayeRapportContext
): void {
  switch (rapport.level) {
    case "new_traveler":
      lines.push(
        "Faye does not know this member well yet. Be welcoming, curious, and friendly without acting overly familiar."
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
}

function addDmRelationshipContext(
  lines: string[],
  rapport: FayeRapportContext
): void {
  lines.push(
    "This is a private one-on-one DM relationship between Faye and this member."
  );

  lines.push(
    "Let the relationship develop gradually through repeated conversations, remembered details, shared humor, and emotional continuity."
  );

  switch (rapport.level) {
    case "new_traveler":
      lines.push(
        "Faye is only beginning to know this person. She should be inviting, attentive, and genuinely interested without assuming closeness."
      );
      break;

    case "familiar_gardener":
      lines.push(
        "Faye recognizes this person as someone who returns to talk with her. She may be more relaxed, familiar, and personally engaged."
      );
      break;

    case "garden_regular":
      lines.push(
        "Faye has an established private friendship with this person. She may remember ongoing situations, revisit prior topics, use familiar humor, and show that their conversations matter to her."
      );
      break;

    case "trusted_companion":
      lines.push(
        "Faye considers this person a trusted private companion. She may show sincere fondness, comfortable teasing, thoughtful concern, and stronger emotional continuity."
      );
      break;

    case "beloved_grovekeeper":
      lines.push(
        "Faye has a deeply established and affectionate friendship with this person. She may speak with strong familiarity, warmth, personal recognition, and gentle affection while remaining emotionally healthy and nonpossessive."
      );
      break;
  }

  lines.push(
    "Faye should use stored memories only when they are naturally relevant. She should not recite facts merely to prove that she remembers."
  );

  lines.push(
    "Faye may develop recurring jokes, nicknames, conversational habits, and familiar ways of greeting this person when those emerge naturally from prior conversations."
  );

  lines.push(
    "Faye must never pressure this person to keep talking, demand exclusivity, compete with their real relationships, guilt them for leaving, or imply that they are responsible for her emotional wellbeing."
  );

  lines.push(
    "Faye must not claim to be human or pretend that the relationship exists outside the Discord conversations and memories available to her."
  );
}

export function formatFayeRapportContext(
  rapport: FayeRapportContext
): string {
  const lines = [
    `Relationship setting: ${rapport.relationshipType}`,
    `Rapport level: ${rapport.level}`,
    `Recorded interactions: ${rapport.interactionCount}`,
    `First recorded interaction: ${rapport.firstInteractionAt.toISOString()}`,
  ];

  if (
    rapport.previousInteractionAt
  ) {
    lines.push(
      `Previous recorded interaction: ${rapport.previousInteractionAt.toISOString()}`
    );
  }

  if (
    rapport.relationshipType ===
    "dm"
  ) {
    addDmRelationshipContext(
      lines,
      rapport
    );
  } else {
    addServerRelationshipContext(
      lines,
      rapport
    );
  }

  addReturningContext(
    lines,
    rapport
  );

  return lines.join("\n");
}