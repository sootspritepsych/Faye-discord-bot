import { pool } from "./database";
import { levelFor, speciesNames, type Species } from "./petPalsBeta";

type Fighter = {user_id:string;pal_name:string;starter_species:Species;xp:number};
const moves: Record<Species,string[]> = {
  jelly_dragon:["🫧 Bubble Burst","✨ Starlight Splash","🛡️ Moonlit Shield"],
  cat_frog:["🌿 Lily Leap","💦 Pond Pounce","🐾 Whisker Whirl"],
  fox_raccoon:["🍂 Forest Feint","🦊 Trickster Dash","🌙 Shadow Swipe"]
};
export async function initPetBattles() {
  await pool.query(`CREATE TABLE IF NOT EXISTS pet_pals_battles (
    id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL,
    challenger_id TEXT NOT NULL, opponent_id TEXT NOT NULL,
    winner_id TEXT NOT NULL, loser_id TEXT NOT NULL,
    battle_log TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS pet_pals_battles_users ON pet_pals_battles(guild_id,challenger_id,opponent_id,created_at)");
}
function power(f:Fighter) {
  const level=levelFor(f.xp);
  return {level,hp:55+level*3,attack:8+Math.floor(level*0.8),defense:3+Math.floor(level*0.35),speed:8+Math.floor(level*0.4)};
}
export async function battle(guild:string,challenger:string,opponent:string) {
  if(challenger===opponent) throw new Error("You can't battle your own Pet Pal!");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize battles in this guild so concurrent commands cannot bypass limits.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), 83724)",[guild]);
    const result=await client.query<Fighter>("SELECT user_id,pal_name,starter_species,xp FROM pet_pals_beta WHERE guild_id=$1 AND user_id=ANY($2::text[])",[guild,[challenger,opponent]]);
    const a=result.rows.find(r=>r.user_id===challenger),b=result.rows.find(r=>r.user_id===opponent);
    if(!a || !b) throw new Error("Both gardeners must hatch a Pet Pal before battling!");
    const recent=await client.query("SELECT count(*)::int AS count FROM pet_pals_battles WHERE guild_id=$1 AND challenger_id=$2 AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",[guild,challenger]);
    if(Number(recent.rows[0].count)>=3) throw new Error("You've used all 3 battles for today! Come back tomorrow. 🌙");
    const repeat=await client.query("SELECT 1 FROM pet_pals_battles WHERE guild_id=$1 AND created_at>now()-interval '1 hour' AND ((challenger_id=$2 AND opponent_id=$3) OR (challenger_id=$3 AND opponent_id=$2)) LIMIT 1",[guild,challenger,opponent]);
    if(repeat.rowCount) throw new Error("These two Pet Pals already battled recently. Try again in an hour! 🌸");
    const pa=power(a),pb=power(b);
    let ha=pa.hp,hb=pb.hp;
    const log:string[]=[];
    const first=Math.random() < (pa.speed/(pa.speed+pb.speed));
    for(let turn=0;turn<24 && ha>0 && hb>0;turn++){
      const attackerIsA=(turn%2===0)===first;
      const atk=attackerIsA?a:b, def=attackerIsA?b:a;
      const ap=attackerIsA?pa:pb,dp=attackerIsA?pb:pa;
      const move=moves[atk.starter_species][Math.floor(Math.random()*3)];
      const damage=Math.max(2,Math.floor(ap.attack*(0.8+Math.random()*0.5)-dp.defense*0.45));
      if(attackerIsA) hb=Math.max(0,hb-damage); else ha=Math.max(0,ha-damage);
      if(log.length<8) log.push(`**${atk.pal_name}** uses ${move} for **${damage}** damage! (${def.pal_name}: ${attackerIsA?hb:ha} HP)`);
    }
    const winner=ha===hb?(Math.random()<0.5?a:b):(ha>hb?a:b);
    const loser=winner===a?b:a;
    const summary=log.join("\n");
    await client.query("INSERT INTO pet_pals_battles(guild_id,challenger_id,opponent_id,winner_id,loser_id,battle_log) VALUES($1,$2,$3,$4,$5,$6)",[guild,challenger,opponent,winner.user_id,loser.user_id,summary]);
    // XP awarded once per battle, even when a player loses.
    await client.query("UPDATE pet_pals_beta SET xp=xp+CASE WHEN user_id=$3 THEN 20 ELSE 8 END WHERE guild_id=$1 AND user_id=ANY($2::text[])",[guild,[challenger,opponent],winner.user_id]);
    await client.query("COMMIT");
    return {a,b,pa,pb,winner,loser,summary,ha,hb};
  } catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export async function battleStats(guild:string,user:string) {
  const result=await pool.query("SELECT count(*)::int AS battles,count(*) FILTER(WHERE winner_id=$2)::int AS wins FROM pet_pals_battles WHERE guild_id=$1 AND (challenger_id=$2 OR opponent_id=$2)",[guild,user]);
  return result.rows[0] as {battles:number;wins:number};
}
