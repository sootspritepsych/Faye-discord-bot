import { pool } from "./database";

export type GardenPeriod = "day" | "week" | "month";
export type GardenRanking = "all" | "chat" | "reaction";
export type GardenSpecies = "sunflower" | "tulip" | "rose" | "lavender" | "tomato" | "carrot" | "pumpkin" | "fern";
export type GardenOrnament = "star" | "red_bauble" | "gold_bauble" | "snowflake" | "ribbon" | "lights";

const chicagoDay = "() => ''"; // Calendar dates are calculated by PostgreSQL, not the Railway host's timezone.
const LOCAL_DAY_SQL = "(date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')";
const settingsCache = new Map<string, { enabled: boolean; until: number }>();
const featureCacheMs = 30_000;

export async function gardenEnabled(guildId: string): Promise<boolean> {
  const cache = settingsCache.get(guildId);
  if (cache && cache.until > Date.now()) return cache.enabled;
  const result = await pool.query<{ enabled: boolean }>(
    "SELECT enabled FROM faye_garden_settings WHERE guild_id=$1",
    [guildId]
  );
  const enabled = result.rows[0]?.enabled === true;
  settingsCache.set(guildId, { enabled, until: Date.now() + featureCacheMs });
  return enabled;
}

export async function setGardenEnabled(guildId: string, enabled: boolean): Promise<void> {
  await pool.query(
    "INSERT INTO faye_garden_settings (guild_id, enabled) VALUES ($1,$2) " +
      "ON CONFLICT (guild_id) DO UPDATE SET enabled=EXCLUDED.enabled",
    [guildId, enabled]
  );
  settingsCache.delete(guildId);
}

/** Award only eligible actions. An action is at most one point per unique source.
 * Neither the existing XP system nor the casino is changed.
 */
export async function recordGardenActivity(
  guildId: string,
  userId: string,
  kind: "chat" | "reaction",
  sourceId: string
): Promise<boolean> {
  if (!(await gardenEnabled(guildId))) return false;
  const limit = kind === "chat" ? 60 : 35;
  const cooldown = kind === "chat" ? 45 : 25;
  const result = await pool.query(
    `INSERT INTO faye_garden_activity (guild_id, user_id, kind, source_id, points)
     SELECT $1,$2,$3,$4,1
     WHERE (SELECT count(*) FROM faye_garden_activity
       WHERE guild_id=$1 AND user_id=$2 AND kind=$3 AND created_at >= ${LOCAL_DAY_SQL}) < $5
       AND NOT EXISTS (
         SELECT 1 FROM faye_garden_activity
         WHERE guild_id=$1 AND user_id=$2 AND kind=$3
           AND created_at >= now() - ($6::integer * interval '1 second')
       )
     ON CONFLICT (guild_id, source_id) DO NOTHING RETURNING id`,
    [guildId, userId, kind, sourceId, limit, cooldown]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function trackGardenMessage(
  guildId: string,
  userId: string,
  messageId: string,
  content: string,
  hasAttachment: boolean
): Promise<void> {
  const trimmed = content.trim();
  // Don't count command spam, empty text, links-only posts or tiny repeated messages.
  if (trimmed.startsWith("/") || trimmed.startsWith("!") || trimmed.startsWith(".")) return;
  if (!hasAttachment && trimmed.replace(/https?:\/\/\S+/g, "").trim().length < 8) return;
  await recordGardenActivity(guildId, userId, "chat", "chat:" + messageId);
}

export async function trackGardenReaction(
  guildId: string,
  reactorId: string,
  messageId: string
): Promise<void> {
  // A member earns at most one credited reaction per message, even with multiple emoji.
  await recordGardenActivity(guildId, reactorId, "reaction", "react:" + messageId + ":" + reactorId);
}

export function treeStage(points: number): { stage: number; name: string; nextAt: number | null } {
  const stages = [
    { at: 0, name: "Tiny Seed" },
    { at: 100, name: "Sprout" },
    { at: 500, name: "Sapling" },
    { at: 1500, name: "Young Tree" },
    { at: 4000, name: "Flourishing Tree" },
    { at: 10000, name: "Ancient Harmony Tree" },
  ];
  let index = 0;
  for (let i = 0; i < stages.length; i++) if (points >= stages[i].at) index = i;
  return { stage: index, name: stages[index].name, nextAt: stages[index + 1]?.at ?? null };
}

export async function getGardenOverview(guildId: string) {
  const [settings, totals, plantCount, ornaments] = await Promise.all([
    pool.query<{ enabled: boolean; tree_name: string }>(
      "SELECT enabled, tree_name FROM faye_garden_settings WHERE guild_id=$1", [guildId]),
    pool.query<{ points: string; chats: string; reactions: string; gardeners: string }>(
      "SELECT COALESCE(sum(points),0)::text AS points," +
      " count(*) FILTER (WHERE kind='chat')::text AS chats," +
      " count(*) FILTER (WHERE kind='reaction')::text AS reactions," +
      " count(DISTINCT user_id)::text AS gardeners FROM faye_garden_activity WHERE guild_id=$1",
      [guildId]
    ),
    pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM faye_garden_plants WHERE guild_id=$1 AND harvested_at IS NULL", [guildId]
    ),
    pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM faye_garden_ornaments WHERE guild_id=$1 AND season=$2",
      [guildId, new Date().getUTCFullYear()]
    )
  ]);
  const t = totals.rows[0];
  const points = Number(t?.points ?? 0);
  return {
    enabled: settings.rows[0]?.enabled ?? false,
    treeName: settings.rows[0]?.tree_name ?? "Harmony Tree",
    points,
    ...treeStage(points),
    chatActions: Number(t?.chats ?? 0),
    reactions: Number(t?.reactions ?? 0),
    contributors: Number(t?.gardeners ?? 0),
    livingPlants: Number(plantCount.rows[0]?.n ?? 0),
    ornaments: Number(ornaments.rows[0]?.n ?? 0),
  };
}

function periodStart(period: GardenPeriod): string {
  if (period === "day") return "date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'";
  if (period === "week") return "date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'";
  return "date_trunc('month', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'";
}

export async function gardenLeaderboard(
  guildId: string, period: GardenPeriod, ranking: GardenRanking, limit = 10
) {
  const filter = ranking === "all" ? "" : ranking === "chat" ? "AND kind='chat'" : "AND kind='reaction'";
  // period and ranking are unions, not free-form SQL from the user.
  const result = await pool.query<{
    user_id: string; score: string; chats: string; reactions: string; actions: string;
  }>(
    `SELECT user_id, COALESCE(sum(points),0)::text AS score,
       count(*) FILTER (WHERE kind='chat')::text AS chats,
       count(*) FILTER (WHERE kind='reaction')::text AS reactions,
       count(*)::text AS actions
     FROM faye_garden_activity WHERE guild_id=$1 AND created_at >= (${periodStart(period)})
       ${filter}
     GROUP BY user_id ORDER BY sum(points) DESC, count(*) DESC, user_id ASC LIMIT $2`,
    [guildId, Math.min(50, Math.max(1, limit))]
  );
  return result.rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    score: Number(r.score),
    chats: Number(r.chats),
    reactions: Number(r.reactions),
    actions: Number(r.actions),
  }));
}

export async function gardenerStats(guildId: string, userId: string) {
  const result = await pool.query<{points:string; chats:string; reactions:string; plants:string}>(
    `SELECT
      (SELECT COALESCE(sum(points),0)::text FROM faye_garden_activity WHERE guild_id=$1 AND user_id=$2) AS points,
      (SELECT count(*)::text FROM faye_garden_activity WHERE guild_id=$1 AND user_id=$2 AND kind='chat') AS chats,
      (SELECT count(*)::text FROM faye_garden_activity WHERE guild_id=$1 AND user_id=$2 AND kind='reaction') AS reactions,
      (SELECT count(*)::text FROM faye_garden_plants WHERE guild_id=$1 AND owner_id=$2) AS plants`,
    [guildId, userId]
  );
  return Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)]));
}

export async function plantGardenSeed(guildId: string, userId: string, species: GardenSpecies) {
  if (!(await gardenEnabled(guildId))) return { status: "disabled" as const };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Limit each member to one new plant per Central calendar day.
    const result = await client.query<{ id: string }>(
      `INSERT INTO faye_garden_plants (guild_id, owner_id, species)
       SELECT $1,$2,$3 WHERE NOT EXISTS (
         SELECT 1 FROM faye_garden_plants WHERE guild_id=$1 AND owner_id=$2
         AND planted_at >= ${LOCAL_DAY_SQL})
       RETURNING id`,
      [guildId, userId, species]
    );
    if (!result.rows.length) { await client.query("ROLLBACK"); return { status: "daily_limit" as const }; }
    const id = result.rows[0].id;
    await client.query(
      "INSERT INTO faye_garden_activity (guild_id,user_id,kind,source_id,points) VALUES ($1,$2,'plant',$3,5)",
      [guildId, userId, "plant:" + id]
    );
    await client.query("COMMIT");
    return { status: "planted" as const, id };
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

export async function waterGardenPlant(guildId: string, userId: string, plantId: number) {
  if (!(await gardenEnabled(guildId))) return { status: "disabled" as const };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const p = await client.query<{ id: string; water_count: number; species: string }>(
      "SELECT id, water_count, species FROM faye_garden_plants " +
      "WHERE guild_id=$1 AND id=$2 AND harvested_at IS NULL FOR UPDATE",
      [guildId, plantId]
    );
    if (!p.rows.length) { await client.query("ROLLBACK"); return { status: "missing" as const }; }
    const cap = await client.query<{n:string}>(
      `SELECT count(*)::text AS n FROM faye_garden_activity
       WHERE guild_id=$1 AND user_id=$2 AND kind='water' AND created_at >= ${LOCAL_DAY_SQL}`,
      [guildId,userId]
    );
    if (Number(cap.rows[0]?.n ?? 0) >= 3) {
      await client.query("ROLLBACK"); return { status: "daily_limit" as const };
    }
    const result = await client.query(
      `INSERT INTO faye_garden_waterings (guild_id,plant_id,user_id,local_date)
       VALUES ($1,$2,$3,(now() AT TIME ZONE 'America/Chicago')::date::text)
       ON CONFLICT DO NOTHING RETURNING plant_id`,
      [guildId,plantId,userId]
    );
    if (!result.rows.length) { await client.query("ROLLBACK"); return { status: "already_watered" as const }; }
    await client.query(
      "UPDATE faye_garden_plants SET water_count=water_count+1 WHERE guild_id=$1 AND id=$2",
      [guildId,plantId]
    );
    await client.query(
      "INSERT INTO faye_garden_activity (guild_id,user_id,kind,source_id,points) VALUES ($1,$2,'water',$3,3)",
      [guildId,userId,"water:"+plantId+":"+userId+":"+(new Date().toISOString().slice(0,10))]
    );
    await client.query("COMMIT");
    return { status:"watered" as const, waterCount:p.rows[0].water_count+1, species:p.rows[0].species };
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

export async function harvestGardenPlant(guildId: string, userId: string, plantId: number) {
  if (!(await gardenEnabled(guildId))) return { status: "disabled" as const };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ species:string }>(
      "UPDATE faye_garden_plants SET harvested_at=now() " +
      "WHERE guild_id=$1 AND owner_id=$2 AND id=$3 AND harvested_at IS NULL AND water_count>=3 RETURNING species",
      [guildId,userId,plantId]
    );
    if (!result.rows.length) { await client.query("ROLLBACK"); return { status:"not_ready" as const }; }
    await client.query(
      "INSERT INTO faye_garden_activity (guild_id,user_id,kind,source_id,points) VALUES ($1,$2,'harvest',$3,5)",
      [guildId,userId,"harvest:"+plantId]
    );
    await client.query("COMMIT");
    return { status:"harvested" as const, species:result.rows[0].species };
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally {client.release();}
}

export async function addGardenOrnament(guildId:string, userId:string, decoration:GardenOrnament) {
  if (!(await gardenEnabled(guildId))) return { status:"disabled" as const };
  const month = new Date().getUTCMonth();
  if (month !== 10 && month !== 11 && month !== 0) return { status:"out_of_season" as const };
  const season = new Date().getUTCFullYear();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{id:string}>(
      `INSERT INTO faye_garden_ornaments (guild_id,user_id,decoration,season)
       SELECT $1,$2,$3,$4 WHERE NOT EXISTS (
         SELECT 1 FROM faye_garden_ornaments WHERE guild_id=$1 AND user_id=$2
         AND created_at >= ${LOCAL_DAY_SQL})
       ON CONFLICT DO NOTHING RETURNING id`,
      [guildId,userId,decoration,season]
    );
    if (!result.rows.length) {await client.query("ROLLBACK");return {status:"limit_or_duplicate" as const};}
    await client.query(
      "INSERT INTO faye_garden_activity (guild_id,user_id,kind,source_id,points) VALUES ($1,$2,'ornament',$3,3)",
      [guildId,userId,"ornament:"+result.rows[0].id]
    );
    await client.query("COMMIT");
    return {status:"added" as const};
  } catch(e) {await client.query("ROLLBACK");throw e;}
  finally {client.release();}
}

export async function gardenPlants(guildId:string, limit=10) {
  const result=await pool.query<{id:string;owner_id:string;species:string;water_count:number}>(
    "SELECT id,owner_id,species,water_count FROM faye_garden_plants "+
    "WHERE guild_id=$1 AND harvested_at IS NULL ORDER BY planted_at DESC LIMIT $2",
    [guildId,Math.min(100,Math.max(1,limit))]
  );
  return result.rows;
}
