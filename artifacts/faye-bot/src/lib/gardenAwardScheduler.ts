import cron from "node-cron";
import { EmbedBuilder, PermissionFlagsBits, type Client } from "discord.js";
import { pool } from "./database";

/** Each 23:59 UTC: day, Sunday week, and the last calendar day of month. */
type Period = "day" | "week" | "month";
const dateKey=(d:Date)=>d.toISOString().slice(0,10);
function due(now:Date):Period[] {
  if(now.getUTCHours()!==23 || now.getUTCMinutes()!==59)return [];
  const periods:Period[]=["day"];
  if(now.getUTCDay()===0)periods.push("week");
  if(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)).getUTCMonth()!==now.getUTCMonth())periods.push("month");
  return periods;
}
function window(period:Period,now:Date):{start:Date;key:string} {
  const y=now.getUTCFullYear(),m=now.getUTCMonth(),d=now.getUTCDate();
  if(period==="month")return {start:new Date(Date.UTC(y,m,1)),key:y+"-"+String(m+1).padStart(2,"0")};
  if(period==="week"){
    const start=new Date(Date.UTC(y,m,d-(now.getUTCDay()+6)%7));
    return {start,key:dateKey(start)};
  }
  const start=new Date(Date.UTC(y,m,d));
  return {start,key:dateKey(start)};
}
let running=false;

export async function postDueGardenAwards(client:Client,now=new Date()):Promise<void>{
  const periods=due(now);
  if(!periods.length || running)return;
  running=true;
  try {
    const guilds=await pool.query<{guild_id:string;channel_id:string|null}>(
      "SELECT s.guild_id, COALESCE(s.announcement_channel_id,g.qotd_post_channel_id) AS channel_id " +
      "FROM faye_garden_settings s LEFT JOIN faye_guild_config g ON g.guild_id=s.guild_id " +
      "WHERE s.enabled=true"
    );
    for(const g of guilds.rows){
      if(!g.channel_id){console.warn("Garden awards require /garden setchannel:",g.guild_id);continue;}
      const guild=client.guilds.cache.get(g.guild_id);
      const channel=await guild?.channels.fetch(g.channel_id).catch(()=>null);
      if(!guild || !channel || !channel.isTextBased() || !("send" in channel) ||
        !channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)){
        console.warn("Garden award channel unavailable or private:",g.guild_id);continue;
      }
      for(const period of periods){
        const {start,key}=window(period,now);
        const leaders=await pool.query<{user_id:string;score:string}>(
          "SELECT user_id,SUM(points)::text AS score FROM faye_garden_activity " +
          "WHERE guild_id=$1 AND created_at >= $2 AND created_at < $3 " +
          "AND kind IN ('chat','reaction','plant','water','harvest','ornament') " +
          "GROUP BY user_id ORDER BY SUM(points) DESC,user_id ASC LIMIT 1",
          [g.guild_id,start,now]
        );
        const winner=leaders.rows[0];
        if(!winner)continue;
        const claimed=await pool.query(
          "INSERT INTO faye_garden_awards (guild_id,period,period_key,winner_id,score,channel_id) " +
          "VALUES ($1,$2,$3,$4,$5,$6) " +
          "ON CONFLICT (guild_id,period,period_key) DO NOTHING RETURNING period_key",
          [g.guild_id,period,key,winner.user_id,Number(winner.score),g.channel_id]
        );
        if(!claimed.rowCount)continue;
        const label=period==="day"?"Day":period==="week"?"Week":"Month";
        const emoji=period==="day"?"☀️":period==="week"?"🌿":"🌙";
        try {
          const embed=new EmbedBuilder().setColor(0x73ad80)
            .setTitle("🏆 "+emoji+" Gardener of the "+label+"!")
            .setDescription("A huge thank-you to <@"+winner.user_id+">! 🌷\n"+
              "You helped our shared Harmony Tree grow with **"+Number(winner.score).toLocaleString()+
              " growth points** this "+label.toLowerCase()+".\n\n"+
              "🌳 Every gardener matters. Keep planting, watering, chatting and supporting each other!")
            .setURL("https://gardenofharmony.up.railway.app/garden")
            .setFooter({text:"UTC award window • "+key+" • Faye & Lilith grow the tree but cannot win"})
            .setTimestamp(now);
          const sent=await channel.send({
            content:"🎉 Congratulations <@"+winner.user_id+">!",
            embeds:[embed],allowedMentions:{parse:[],users:[winner.user_id]},
          });
          await pool.query("UPDATE faye_garden_awards SET message_id=$4 "+
            "WHERE guild_id=$1 AND period=$2 AND period_key=$3",
            [g.guild_id,period,key,sent.id]
          );
          console.log("🏆 Garden "+period+" award posted in "+g.guild_id+" for "+winner.user_id);
        }catch(err){
          await pool.query("DELETE FROM faye_garden_awards WHERE guild_id=$1 AND period=$2 "+
            "AND period_key=$3 AND message_id IS NULL",
            [g.guild_id,period,key]
          );
          console.error("Garden award failed:",err);
        }
      }
    }
  }finally{running=false;}
}
export function startGardenAwards(client:Client):void{
  cron.schedule("59 23 * * *",()=>{
    void postDueGardenAwards(client).catch(e=>console.error("Garden award scheduler:",e));
  },{timezone:"UTC"});
  void postDueGardenAwards(client).catch(e=>console.error("Garden award startup:",e));
  console.log("🏆 Garden awards: 23:59 UTC daily, Sunday and calendar month-end");
}
