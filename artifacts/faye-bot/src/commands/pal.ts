import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { battle, battleStats } from "../lib/petBattles";
import { palRankings } from "../lib/palRankings";
import { award,betaEnabled,cleanName,getPal,hatch,levelFor,rename,speciesNames, type Species } from "../lib/petPalsBeta";
// Nine artwork URLs, one per species and evolution stage. HTTPS images only.
function palArtUrl(species: Species, stage: number): string | null {
  const key = `PET_PAL_ART_${species.toUpperCase()}_${stage + 1}`;
  const url = process.env[key]?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch { return null; }
}
export const data = new SlashCommandBuilder().setName("pal").setDescription("Raise your Garden of Harmony Pet Pal (tester beta)")
 .addSubcommand(s=>s.setName("hatch").setDescription("Choose your permanent starter").addStringOption(o=>o.setName("starter").setDescription("Choose your Pal").setRequired(true).addChoices({name:"Jelly Dragon",value:"jelly_dragon"},{name:"Cat Frog",value:"cat_frog"},{name:"Fox Raccoon",value:"fox_raccoon"})).addStringOption(o=>o.setName("name").setDescription("Your Pal's name").setRequired(true)))
 .addSubcommand(s=>s.setName("name").setDescription("Name or rename your Pal").addStringOption(o=>o.setName("name").setDescription("New name").setRequired(true)))
 .addSubcommand(s=>s.setName("rename").setDescription("Rename your Pal").addStringOption(o=>o.setName("name").setDescription("New name").setRequired(true)))
 .addSubcommand(s=>s.setName("view").setDescription("View your Pal or another member's Pal").addUserOption(o=>o.setName("member").setDescription("Member to view")))
 .addSubcommand(s=>s.setName("battle").setDescription("Automatically battle another gardener’s Pet Pal").addUserOption(o=>o.setName("opponent").setDescription("Gardener to challenge").setRequired(true)))
 .addSubcommand(s=>s.setName("battle-stats").setDescription("See Pet Pal battle wins and losses").addUserOption(o=>o.setName("member").setDescription("Member to view")))
 .addSubcommand(s=>s.setName("rankings").setDescription("View XP or battle leaderboards").addStringOption(o=>o.setName("type").setDescription("Leaderboard").setRequired(true).addChoices({name:"XP",value:"xp"},{name:"Battles",value:"battles"})))
 .addSubcommand(s=>s.setName("rank").setDescription("See your Pal's position on both leaderboards"))
 .addSubcommand(s=>s.setName("stats").setDescription("See your Pal's XP and battle record"))
 .addSubcommand(s=>s.setName("play").setDescription("Play with your Pal for XP"))
 .addSubcommand(s=>s.setName("care").setDescription("Complete an optional self-care quest").addStringOption(o=>o.setName("task").setDescription("Choose a self-care activity").setRequired(true).addChoices({name:"Drink water",value:"water"},{name:"Eat a meal or snack",value:"food"},{name:"Take a break",value:"rest"},{name:"Move or stretch",value:"move"},{name:"Do something joyful",value:"joy"},{name:"Get some fresh air",value:"fresh_air"},{name:"Take your medication",value:"medication"},{name:"Brush your teeth",value:"teeth"},{name:"Wash your face or shower",value:"wash"},{name:"Tidy a small space",value:"tidy"},{name:"Connect with someone",value:"connect"},{name:"Practice deep breathing",value:"breathe"},{name:"Journal your thoughts",value:"journal"},{name:"Enjoy a hobby",value:"hobby"},{name:"Set a boundary",value:"boundary"},{name:"Ask for help",value:"help"},{name:"Spend time with a pet",value:"pet"},{name:"Go to bed or rest",value:"sleep"},{name:"Take a screen break",value:"screen"},{name:"Celebrate a small win",value:"win"})));
export async function execute(i:ChatInputCommandInteraction) {
  if (!i.guildId || !betaEnabled(i.channelId)) {await i.reply({content:"🌱 Pet Pals is currently available only in the designated tester channel.",ephemeral:false});return;}
  const sub=i.options.getSubcommand(), user=i.user.id,guild=i.guildId;
  try {
    if (sub==="rankings" || sub==="rank" || sub==="stats") {
      await i.deferReply();
      const boards=await palRankings(guild);
      const format=(n:number)=>n===1?"🥇":n===2?"🥈":n===3?"🥉":`#${n}`;
      if (sub==="rankings") {
        const type=i.options.getString("type",true) as "xp"|"battles";
        const entries=boards[type].slice(0,10);
        const lines=entries.map((p,index)=>type==="xp"
          ?`${format(index+1)} **${p.palName}** (<@${p.userId}>) — Lv. ${p.level} • ${p.xp.toLocaleString()} XP`
          :`${format(index+1)} **${p.palName}** (<@${p.userId}>) — ${p.rating} rating • ${p.wins}W/${p.losses}L • ${Math.round(p.wins/p.battles*100)}% wins • streak ${p.streak>0?"+":""}${p.streak}`);
        await i.editReply({embeds:[new EmbedBuilder().setColor(0x91b99b)
          .setTitle(type==="xp"?"🌟 Pet Pals XP Rankings":"⚔️ Pet Pals Battle Rankings")
          .setDescription(lines.join("\n") || "No eligible Pals yet. 🌱")
          .setFooter({text:"Garden of Harmony • Live lifetime rankings"})]});return;
      }
      const pal=await getPal(guild,user);
      if (!pal) {await i.editReply("Hatch your starter first with `/pal hatch`.");return;}
      const x=boards.xp.findIndex(p=>p.userId===user);
      const b=boards.battles.findIndex(p=>p.userId===user);
      const record=boards.xp[x];
      const summary=`🌟 **${pal.pal_name}** • Level ${levelFor(pal.xp)} • ${pal.xp.toLocaleString()} XP\n🏅 XP rank: **#${x+1}** of ${boards.xp.length}\n⚔️ Battle rank: **${b<0?"Unranked":`#${b+1} of ${boards.battles.length}`}**\n🏆 ${record.wins} wins • ${record.losses} losses • ${record.battles?Math.round(record.wins/record.battles*100):0}% win rate • Rating ${record.rating} • Streak ${record.streak}`;
      await i.editReply({content:summary});return;
    }
    if (sub==="hatch") {
      const species=i.options.getString("starter",true) as Species;
      const name=cleanName(i.options.getString("name",true));
      const created=await hatch(guild,user,species,name);
      await i.reply({content:created?`🥚✨ **${name}** hatched! Your **${speciesNames[species][0]}** is your one permanent starter species. Use \`/pal view\`!`:"You already have a starter! You can rename it, but you cannot change its species.",ephemeral:false});return;
    }
    if (sub==="view") {
      const target=i.options.getUser("member")??i.user;
      const pal=await getPal(guild,target.id);
      if (!pal) {await i.reply({content:"No Pal hatched yet! Use `/pal hatch` to choose your starter.",ephemeral:false});return;}
      const level=levelFor(pal.xp),stage=level>=40?2:level>=15?1:0;
      const embed=new EmbedBuilder().setColor(0x91b99b).setTitle(`🐾 ${pal.pal_name}`).setDescription(`**${speciesNames[pal.starter_species][stage]}** • ${speciesNames[pal.starter_species][0].split(" ")[0]} family`).addFields({name:"Level",value:String(level),inline:true},{name:"XP",value:String(pal.xp),inline:true},{name:"Evolution",value:`${stage+1}/3`,inline:true}).setFooter({text:`Belongs to ${target.username} • Tester beta`});
      const artwork = palArtUrl(pal.starter_species,stage);
      if (artwork) embed.setImage(artwork);
      await i.reply({embeds:[embed]});return;
    }
    if (sub==="battle-stats") {
      const target=i.options.getUser("member")??i.user;
      const stats=await battleStats(guild,target.id);
      await i.reply({content:`⚔️ **${target.username}'s Pet Pal Battles** — 🏆 **${stats.wins} wins** • **${stats.battles-stats.wins} losses** • **${stats.battles} total**`});return;
    }
    if (sub==="battle") {
      const opponent=i.options.getUser("opponent",true);
      if(opponent.bot) {await i.reply({content:"🌿 Choose a real gardener to battle!"});return;}
      await i.deferReply();
      try {
        const result=await battle(guild,user,opponent.id);
        const embed=new EmbedBuilder().setColor(0x91b99b).setTitle("⚔️🌸 Pet Pals Battle!")
          .setDescription(`<@${user}> **${result.a.pal_name}** (Lv. ${result.pa.level}) vs <@${opponent.id}> **${result.b.pal_name}** (Lv. ${result.pb.level})\n\n${result.summary}\n\n🏆 **${result.winner.pal_name} wins!**\n✨ Winner: **+20 XP** • Other Pal: **+8 XP**`)
          .setFooter({text:"3 challenges per gardener per day • Same matchup: 1-hour cooldown"});
        await i.editReply({embeds:[embed]});
      } catch(error) {await i.editReply({content:error instanceof Error?error.message:"The battle couldn't begin. Please try again."});}
      return;
    }
    const pal=await getPal(guild,user);
    if (!pal) {await i.reply({content:"Hatch your starter first with `/pal hatch`.",ephemeral:false});return;}
    if (sub==="name"||sub==="rename") {
      const name=cleanName(i.options.getString("name",true));await rename(guild,user,name);
      await i.reply({content:`🌸 Your Pal is now named **${name}**!`,ephemeral:false});return;
    }
    if (sub==="play"||sub==="care") {
      const kind=sub==="play"?"pal_play":"self_care";
      const source=sub==="play"?`play:${i.id}`:`care:${i.options.getString("task",true)}:${new Date().toISOString().slice(0,10)}`;
      const xp=await award(guild,user,kind,source);
      const taskLabels: Record<string,string> = {water:"💧 Drank water",food:"🍎 Ate a meal or snack",rest:"🌙 Took a break",move:"🌿 Moved or stretched",joy:"🌸 Did something joyful",fresh_air:"🍃 Got some fresh air",medication:"💊 Took prescribed medication",teeth:"🪥 Brushed their teeth",wash:"🫧 Washed up or showered",tidy:"🧺 Tidied a small space",connect:"💌 Connected with someone",breathe:"🌬️ Practiced deep breathing",journal:"📓 Journaled their thoughts",hobby:"🎨 Enjoyed a hobby",boundary:"🛡️ Set a boundary",help:"🤝 Asked for help",pet:"🐾 Spent time with a pet",sleep:"🌙 Made time for sleep or rest",screen:"📵 Took a screen break",win:"✨ Celebrated a small win"};
      const activity = sub==="care" ? taskLabels[i.options.getString("task",true)] : null;
      await i.reply({content:xp?(activity?`💕 **${i.user.username}** completed self-care: **${activity}**! ${pal.pal_name} earned **+${xp} XP**!`:`💕 **${i.user.username}** played with **${pal.pal_name}** and earned **+${xp} XP**!`):(activity?`🌿 **${i.user.username}** selected **${activity}**, but has already earned this reward or reached today\'s limit.`:"🌿 You\'ve already earned this reward or reached today\'s limit. Come back later!"),ephemeral:false});return;
    }
  } catch(e) {const content=e instanceof Error?e.message:"Something went wrong."; if(i.deferred||i.replied) await i.editReply({content}); else await i.reply({content,ephemeral:false});}
}
