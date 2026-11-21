import { pool } from "./database";
import { levelFor } from "./petPalsBeta";

export type PalRanking = {
  userId: string; palName: string; xp: number; level: number;
  wins: number; losses: number; battles: number; rating: number; streak: number;
};
export async function palRankings(guild: string): Promise<{ xp: PalRanking[]; battles: PalRanking[] }> {
  const pals = await pool.query<{user_id:string;pal_name:string;xp:number}>(
    "SELECT user_id,pal_name,xp FROM pet_pals_beta WHERE guild_id=$1", [guild]);
  const records = new Map<string, PalRanking>();
  for (const p of pals.rows) records.set(p.user_id, {
    userId:p.user_id,palName:p.pal_name,xp:p.xp,level:levelFor(p.xp),
    wins:0,losses:0,battles:0,rating:1000,streak:0
  });
  const history = await pool.query<{winner_id:string;loser_id:string}>(
    "SELECT winner_id,loser_id FROM pet_pals_battles WHERE guild_id=$1 ORDER BY created_at ASC,id ASC", [guild]);
  for (const game of history.rows) {
    const winner=records.get(game.winner_id), loser=records.get(game.loser_id);
    if (!winner || !loser) continue;
    const expected=1/(1+Math.pow(10,(loser.rating-winner.rating)/400));
    const delta=Math.max(1,Math.round(24*(1-expected)));
    winner.rating+=delta;loser.rating-=delta;
    winner.wins++;winner.battles++;winner.streak=Math.max(1,winner.streak+1);
    loser.losses++;loser.battles++;loser.streak=Math.min(-1,loser.streak-1);
  }
  const all=[...records.values()];
  return {
    xp:[...all].sort((a,b)=>b.xp-a.xp || a.userId.localeCompare(b.userId)),
    battles:all.filter(p=>p.battles>0).sort((a,b)=>b.rating-a.rating || b.wins-a.wins || a.userId.localeCompare(b.userId))
  };
}
