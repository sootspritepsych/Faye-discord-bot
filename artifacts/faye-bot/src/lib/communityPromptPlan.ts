export type Guardian = "faye" | "lilith";
export type Topic = "mental" | "exercise" | "money" | "growth";
export interface PromptPlan {
  topic: Topic;
  name: string;
  env: string;
  weekday: number;
  guardian: Guardian | "alternate";
  prompts: readonly string[];
}

export const COMMUNITY_PROMPTS: readonly PromptPlan[] = [
  { topic: "mental", name: "mentalhealth", env: "MENTAL_HEALTH_CHANNEL_ID", weekday: 1, guardian: "faye", prompts: [
    "Do you need encouragement, a distraction, or space to vent today? Sharing is always optional. 🌿",
    "What is one small comfort that helped you get through this week?",
    "If your energy were weather today, what would the forecast be? No explanation needed. ☁️",
    "What would make today a little gentler for you?",
    "What is something you wish people understood when you are having a difficult day?",
    "Would you like to leave a worry here or share something that brought you peace? Either is welcome.",
    "What is your favorite low-effort way to unwind?",
    "What kind of support feels helpful to you: listening, company, encouragement, or something else?",
    "What is one thing you are giving yourself permission to leave unfinished today?",
    "What song, place, or familiar routine feels comforting lately?",
    "What is a small boundary you are glad you made room for? No private details needed.",
    "You do not need a bright answer: how has your week felt so far? 🌿",
  ] },
  { topic: "exercise", name: "exerciseanddiet", env: "EXERCISE_DIET_CHANNEL_ID", weekday: 3, guardian: "alternate", prompts: [
    "What is your go-to meal when cooking feels impossible? Easy counts. 🌿",
    "What form of movement would you actually enjoy if nobody was keeping score?",
    "What snack or meal have you been enjoying lately?",
    "Walking, dancing, stretching, resting: what fits your energy today?",
    "What kitchen shortcut deserves more appreciation?",
    "What helps make movement feel fun or accessible for you?",
    "What is a meal you could happily eat on repeat?",
    "Do you prefer moving with music, a podcast, company, or quiet?",
    "What is the easiest thing you made this week that tasted great?",
    "What hobby gets you moving without feeling like a workout?",
    "What food would you recommend to someone who wants something comforting and simple?",
    "What is one way you made room for your body's needs this week? Rest counts too.",
  ] },
  { topic: "money", name: "robinsinvestmentcorner", env: "INVESTMENT_CORNER_CHANNEL_ID", weekday: 5, guardian: "lilith", prompts: [
    "What purchase did you convince yourself was an investment? I am listening. 🌙",
    "What tiny purchase has given you a suspiciously large amount of joy?",
    "What are you saving toward? Vague answers are perfectly acceptable.",
    "What subscription finally lost its place in your budget?",
    "What was your most surprisingly useful secondhand find?",
    "What free activity feels far more luxurious than it has any right to?",
    "What impulse purchase sat in your cart long enough for the spell to break?",
    "What is something you stopped buying and barely missed?",
    "What purchase would you happily make again?",
    "What boring purchase turned out to be absolutely worth it?",
    "What is your favorite way to make a no-spend evening enjoyable?",
    "Which fictional character would be the worst person to share a budget with?",
  ] },
  { topic: "growth", name: "growthanddevelopment", env: "GROWTH_DEVELOPMENT_CHANNEL_ID", weekday: 0, guardian: "faye", prompts: [
    "What is a small win from this week that deserves a little celebration? 🌱",
    "What is one manageable thing you would like to make room for next week?",
    "What have you learned lately, even if it seems tiny?",
    "What unfinished goal could use a smaller first step?",
    "What are you proud of yourself for trying? The outcome does not have to be perfect.",
    "What is something you can do now that used to feel difficult?",
    "What is a habit or routine you are adjusting to fit your actual life?",
    "What is one thing you would like to understand better?",
    "What helped you get started on something you had been putting off?",
    "What is something you are learning to do at your own pace?",
    "What would count as enough for the coming week?",
    "What is a little piece of progress you might otherwise forget to notice? 🌿",
  ] },
];

export function normalizedCommunityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

/** Local calendar dates keep the weekly slots stable through Chicago DST changes. */
export function communityDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (key: string) => parts.find(part => part.type === key)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return { date, hour: Number(get("hour")), weekday: new Date(midnight).getUTCDay(),
    week: Math.floor((midnight - Date.UTC(1970, 0, 5)) / (7 * 86400000)) };
}

export function promptGuardian(plan: PromptPlan, week: number): Guardian {
  return plan.guardian === "alternate" ? (week % 2 === 0 ? "faye" : "lilith") : plan.guardian;
}

export function dueCommunityPrompts(now: Date, guardian: Guardian): PromptPlan[] {
  const day = communityDay(now);
  // One hour of grace, no backlog after downtime and no posting on startup outside the slot.
  if (day.hour !== 17) return [];
  return COMMUNITY_PROMPTS.filter(plan => plan.weekday === day.weekday && promptGuardian(plan, day.week) === guardian);
}

export function communityPromptText(plan: PromptPlan, now: Date): string {
  const week = communityDay(now).week;
  return plan.prompts[((week % plan.prompts.length) + plan.prompts.length) % plan.prompts.length];
}
