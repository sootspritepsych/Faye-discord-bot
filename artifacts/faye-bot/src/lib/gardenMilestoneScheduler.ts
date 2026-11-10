import cron from "node-cron";
import { EmbedBuilder, PermissionFlagsBits, type Client } from "discord.js";
import { pool } from "./database";
import { treeStage } from "./gardenService";

const SCENE_URL = "https://garden-of-harmony-migration-production.up.railway.app/api/garden-scene";
const SITE_URL = "https://gardenofharmony.up.railway.app/garden";
let running = false;

/** Existing trees are baselined on first observation; only future evolutions post. */
export async function postGardenMilestones(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    const guilds = await pool.query<{ guild_id: string; channel_id: string | null; points: string }>(
      "SELECT s.guild_id, COALESCE(s.announcement_channel_id,g.qotd_post_channel_id) AS channel_id," +
      " COALESCE(SUM(a.points),0)::text AS points FROM faye_garden_settings s" +
      " LEFT JOIN faye_guild_config g ON g.guild_id=s.guild_id" +
      " LEFT JOIN faye_garden_activity a ON a.guild_id=s.guild_id" +
      " WHERE s.enabled=true GROUP BY s.guild_id,s.announcement_channel_id,g.qotd_post_channel_id"
    );
    for (const row of guilds.rows) {
      const points = Number(row.points);
      const stage = treeStage(points);
      const seeded = await pool.query(
        "INSERT INTO faye_garden_milestone_state (guild_id,last_stage) VALUES ($1,$2)" +
        " ON CONFLICT (guild_id) DO NOTHING RETURNING guild_id",
        [row.guild_id, stage.stage]
      );
      if (seeded.rowCount) continue;
      const current = await pool.query<{last_stage:number}>(
        "SELECT last_stage FROM faye_garden_milestone_state WHERE guild_id=$1", [row.guild_id]
      );
      if (stage.stage <= (current.rows[0]?.last_stage ?? stage.stage)) continue;
      if (!row.channel_id) {
        console.warn("🌳 Set a public garden announcement channel to celebrate milestones:", row.guild_id);
        continue;
      }
      const guild = client.guilds.cache.get(row.guild_id);
      const channel = await guild?.channels.fetch(row.channel_id).catch(() => null);
      if (!guild || !channel || !channel.isTextBased() || !("send" in channel) ||
          !channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
        console.warn("🌳 Garden milestone channel unavailable/private:", row.guild_id);
        continue;
      }
      const embed = new EmbedBuilder()
        .setColor(0x83bb80)
        .setTitle("🌳 The Harmony Tree evolved — " + stage.name + "!")
        .setDescription("The community reached **" + points.toLocaleString() +
          " growth points**! 🌸\n\nThanks for the flowers, kindness, waterings and conversations. Everyone helped this tree flourish!")
        .setImage(SCENE_URL + "?view=tree&v=" + Date.now())
        .setURL(SITE_URL)
        .setFooter({text:"A new chapter in the Garden of Harmony • Keep growing together"})
        .setTimestamp();
      try {
        const sent = await channel.send({embeds:[embed],allowedMentions:{parse:[]}});
        await pool.query(
          "UPDATE faye_garden_milestone_state SET last_stage=$2,message_id=$3,posted_at=NOW()" +
          " WHERE guild_id=$1 AND last_stage<$2",
          [row.guild_id,stage.stage,sent.id]
        );
        console.log("🌳 Garden milestone announced:",row.guild_id,stage.name);
      } catch(error) {
        console.error("🌳 Garden milestone delivery failed:",error);
      }
    }
  } finally {
    running = false;
  }
}

export function startGardenMilestones(client: Client): void {
  cron.schedule("*/2 * * * *", () => {
    void postGardenMilestones(client).catch(error => console.error("Garden milestones:",error));
  },{timezone:"UTC"});
  void postGardenMilestones(client).catch(error => console.error("Garden milestone baseline:",error));
  console.log("🌳 Garden milestone checks every two minutes");
}
