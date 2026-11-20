import { pool } from "./database";
export type Species = "jelly_dragon" | "cat_frog" | "fox_raccoon";
export const speciesNames: Record<Species, string[]> = {
  jelly_dragon: ["Jelly Whelp", "Jelly Drake", "Jelly Seraph"],
  cat_frog: ["Lilypad Kit", "Pond Pouncer", "Lotus Leaper"],
  fox_raccoon: ["Racfox Kit", "Racfox Scout", "Racfox Ranger"],
};
export const PET_PALS_TEST_CHANNEL_ID = process.env.PET_PALS_TEST_CHANNEL_ID || "1573395718171918528";
export const betaEnabled = (channelId: string) => channelId === PET_PALS_TEST_CHANNEL_ID;
export const levelFor = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
export function cleanName(raw: string): string {
  const name = raw.trim().replace(/\\s+/g, " ");
  if (!name || name.length > 24 || /[<>@\\r\\n]/.test(name)) throw new Error("Names must be 1–24 characters without mentions or markup.");
  return name;
}
export async function initPetPals() {
  await pool.query(`CREATE TABLE IF NOT EXISTS pet_pals_beta (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    starter_species TEXT NOT NULL CHECK (starter_species IN ('jelly_dragon','cat_frog','fox_raccoon')),
    pal_name VARCHAR(24) NOT NULL, xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(guild_id,user_id)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pet_pals_beta_activity (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL,
    source_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(guild_id,user_id,kind,source_id)
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS pet_pals_beta_activity_daily ON pet_pals_beta_activity(guild_id,user_id,kind,created_at)");
}
export async function getPal(guild: string, user: string) {
  const r = await pool.query<{starter_species:Species;pal_name:string;xp:number}>(
    "SELECT starter_species,pal_name,xp FROM pet_pals_beta WHERE guild_id=$1 AND user_id=$2", [guild,user]);
  return r.rows[0] ?? null;
}
export async function hatch(guild: string,user: string,species:Species,name:string) {
  const r=await pool.query("INSERT INTO pet_pals_beta(guild_id,user_id,starter_species,pal_name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id",[guild,user,species,cleanName(name)]);
  return r.rowCount === 1;
}
export async function rename(guild:string,user:string,name:string) {
  await pool.query("UPDATE pet_pals_beta SET pal_name=$3 WHERE guild_id=$1 AND user_id=$2",[guild,user,cleanName(name)]);
}
const rewards: Record<string,[number,number]> = {
  message:[2,30], sticker:[2,10], reaction:[1,30], slash_command:[2,20],
  qotd:[10,1], potd:[6,1], self_care:[10,3], friendship:[15,3],
  pal_play:[5,3], garden_water:[5,10], garden_interaction:[3,10], pal_playdate:[15,1],
};
export async function award(guild:string,user:string,kind:string,source:string) {
  if (!rewards[kind]) return 0;
  const [xp,limit]=rewards[kind];
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",[guild,user]);
    const existing=await client.query("SELECT 1 FROM pet_pals_beta WHERE guild_id=$1 AND user_id=$2",[guild,user]);
    if (!existing.rowCount) {await client.query("ROLLBACK");return 0;}
    const count=await client.query<{count:string}>("SELECT count(*)::text AS count FROM pet_pals_beta_activity WHERE guild_id=$1 AND user_id=$2 AND kind=$3 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",[guild,user,kind]);
    if (Number(count.rows[0].count)>=limit) {await client.query("ROLLBACK");return 0;}
    if (kind==="slash_command") {
      const recent=await client.query("SELECT 1 FROM pet_pals_beta_activity WHERE guild_id=$1 AND user_id=$2 AND kind=$3 AND created_at > now()-interval '60 seconds' LIMIT 1",[guild,user,kind]);
      if (recent.rowCount) {await client.query("ROLLBACK");return 0;}
    }
    const inserted=await client.query("INSERT INTO pet_pals_beta_activity(guild_id,user_id,kind,source_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING source_id",[guild,user,kind,source]);
    if (!inserted.rowCount) {await client.query("ROLLBACK");return 0;}
    await client.query("UPDATE pet_pals_beta SET xp=xp+$3 WHERE guild_id=$1 AND user_id=$2",[guild,user,xp]);
    await client.query("COMMIT");return xp;
  } catch(e) {await client.query("ROLLBACK");throw e;} finally {client.release();}
}
