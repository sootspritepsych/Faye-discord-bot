import { randomInt } from "node:crypto";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONDAY = Date.UTC(1970, 0, 5);

/** UTC weeks work consistently for a global server, including DST changes. */
export function confessionWeek(now: Date): Date {
  return new Date(MONDAY + Math.floor((now.getTime() - MONDAY) / WEEK_MS) * WEEK_MS);
}

/** A new plan always falls in the future, including first activation midweek. */
export function randomConfessionTime(week: Date, now: Date): Date {
  const end = week.getTime() + WEEK_MS;
  const start = Math.max(week.getTime(), now.getTime() + 60_000);
  if (start >= end) return new Date(end - 1);
  return new Date(start + randomInt(end - start));
}

export function chooseConfession(bank: readonly string[], recent: readonly string[]): string {
  const unused = bank.filter(line => !recent.includes(line));
  const choices = unused.length ? unused : bank.filter(line => line !== recent[0]);
  if (!choices.length) throw new Error("A confession bank needs at least two lines");
  return choices[randomInt(choices.length)];
}
