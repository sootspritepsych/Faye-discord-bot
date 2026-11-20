import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { award,betaEnabled,cleanName,getPal,hatch,levelFor,rename,speciesNames, type Species } from "../lib/petPalsBeta";
export const data = new SlashCommandBuilder().setName("pal").setDescription("Raise your Garden of Harmony Pet Pal (tester beta)")
 .addSubcommand(s=>s.setName("hatch").setDescription("Choose your permanent starter").addStringOption(o=>o.setName("starter").setDescription("Choose your Pal").setRequired(true).addChoices({name:"Jelly Dragon",value:"jelly_dragon"},{name:"Cat Frog",value:"cat_frog"},{name:"Fox Raccoon",value:"fox_raccoon"})).addStringOption(o=>o.setName("name").setDescription("Your Pal's name").setRequired(true)))
 .addSubcommand(s=>s.setName("name").setDescription("Name or rename your Pal").addStringOption(o=>o.setName("name").setDescription("New name").setRequired(true)))
 .addSubcommand(s=>s.setName("rename").setDescription("Rename your Pal").addStringOption(o=>o.setName("name").setDescription("New name").setRequired(true)))
 .addSubcommand(s=>s.setName("view").setDescription("View your Pal or another member's Pal").addUserOption(o=>o.setName("member").setDescription("Member to view")))
 .addSubcommand(s=>s.setName("play").setDescription("Play with your Pal for XP"))
 .addSubcommand(s=>s.setName("care").setDescription("Complete an optional self-care quest").addStringOption(o=>o.setName("task").setDescription("Choose a self-care activity").setRequired(true).addChoices({name:"Drink water",value:"water"},{name:"Eat a meal or snack",value:"food"},{name:"Take a break",value:"rest"},{name:"Move or stretch",value:"move"},{name:"Do something joyful",value:"joy"})));
export async function execute(i:ChatInputCommandInteraction) {
  if (!i.guildId || !betaEnabled(i.channelId)) {await i.reply({content:"🌱 Pet Pals is currently available only in the designated tester channel.",ephemeral:true});return;}
  const sub=i.options.getSubcommand(), user=i.user.id,guild=i.guildId;
  try {
    if (sub==="hatch") {
      const species=i.options.getString("starter",true) as Species;
      const name=cleanName(i.options.getString("name",true));
      const created=await hatch(guild,user,species,name);
      await i.reply({content:created?`🥚✨ **${name}** hatched! Your **${speciesNames[species][0]}** is your one permanent starter species. Use \`/pal view\`!`:"You already have a starter! You can rename it, but you cannot change its species.",ephemeral:true});return;
    }
    if (sub==="view") {
      const target=i.options.getUser("member")??i.user;
      const pal=await getPal(guild,target.id);
      if (!pal) {await i.reply({content:"No Pal hatched yet! Use `/pal hatch` to choose your starter.",ephemeral:true});return;}
      const level=levelFor(pal.xp),stage=level>=40?2:level>=15?1:0;
      const embed=new EmbedBuilder().setColor(0x91b99b).setTitle(`🐾 ${pal.pal_name}`).setDescription(`**${speciesNames[pal.starter_species][stage]}** • ${speciesNames[pal.starter_species][0].split(" ")[0]} family`).addFields({name:"Level",value:String(level),inline:true},{name:"XP",value:String(pal.xp),inline:true},{name:"Evolution",value:`${stage+1}/3`,inline:true}).setFooter({text:`Belongs to ${target.username} • Tester beta`});
      await i.reply({embeds:[embed]});return;
    }
    const pal=await getPal(guild,user);
    if (!pal) {await i.reply({content:"Hatch your starter first with `/pal hatch`.",ephemeral:true});return;}
    if (sub==="name"||sub==="rename") {
      const name=cleanName(i.options.getString("name",true));await rename(guild,user,name);
      await i.reply({content:`🌸 Your Pal is now named **${name}**!`,ephemeral:true});return;
    }
    if (sub==="play"||sub==="care") {
      const kind=sub==="play"?"pal_play":"self_care";
      const source=sub==="play"?`play:${i.id}`:`care:${i.options.getString("task",true)}:${new Date().toISOString().slice(0,10)}`;
      const xp=await award(guild,user,kind,source);
      await i.reply({content:xp?`💕 ${pal.pal_name} earned **+${xp} XP**!`:"🌿 You've already earned this reward or reached today's limit. Come back later!",ephemeral:true});return;
    }
  } catch(e) {await i.reply({content:e instanceof Error?e.message:"Something went wrong.",ephemeral:true});}
}
