import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  type ButtonInteraction, type Guild,
} from "discord.js";
import { currentGardenHoliday } from "./gardenSeasons";
import { plantEmoji, plantLabel } from "./gardenPlantsCatalog";
import { gardenGuideEmbed } from "./gardenGuide";
import { gardenEnabled, gardenLeaderboard, gardenPlants, getGardenOverview } from "./gardenService";

export type GardenPanel = "tree" | "beds";
const IMAGE_URL = "https://garden-of-harmony-migration-production.up.railway.app/api/garden-scene";
const SITE_URL = "https://gardenofharmony.up.railway.app/garden";

export async function renderGardenView(guildId:string,panel:GardenPanel="tree",guild?:Guild|null) {
  const [garden,day,week,month,plants]=await Promise.all([
    getGardenOverview(guildId),
    gardenLeaderboard(guildId,"day","all",1),
    gardenLeaderboard(guildId,"week","all",1),
    gardenLeaderboard(guildId,"month","all",1),
    gardenPlants(guildId,12),
  ]);
  const holiday=currentGardenHoliday();
  const embed=new EmbedBuilder()
    .setTitle((panel==="tree"?"🌳 The Harmony Tree":"🌼 The Community Garden")+
      " • "+holiday.emoji+" "+holiday.name)
    .setURL(SITE_URL)
    .setColor(0x79b18a)
    .setDescription(
      "**"+garden.points.toLocaleString()+" growth points** • "+garden.name+"\n"+
      (garden.nextAt===null?"✨ Legendary stage!":
        (garden.nextAt-garden.points).toLocaleString()+" points until the next stage")+
      "\n🌼 "+garden.livingPlants+" growing plants • 🎀 "+garden.ornaments+
      " active "+holiday.name+" decorations\n"+
      "💬 "+garden.chatActions+" credited chats • 💚 "+garden.reactions+
      " reactions • 🍃 Faye and Lilith also grow our tree")
    .setImage(IMAGE_URL+"?view="+panel+"&v="+Math.floor(Date.now()/15000))
    .setFooter({text:"Everyone can use these buttons • Garden updates automatically • gardenofharmony.up.railway.app"})
    .setTimestamp();
  if(panel==="beds") {
    embed.addFields({name:"🌼 Latest garden plots",value:plants.length ?
      plants.slice(0,8).map(p=>plantEmoji(p.species,guild)+" **#"+p.id+"** "+plantLabel(p.species)+
        " • "+p.water_count+"/3 💧 • <@"+p.owner_id+">").join("\n") :
      "The garden is ready for its first seed! Try /garden plant."});
  } else {
    embed.addFields(
      {name:"☀️ Top Today",value:day[0]?"<@"+day[0].userId+"> • "+day[0].score+" pts":"🌱 First gardener soon",inline:true},
      {name:"🌿 Top Week",value:week[0]?"<@"+week[0].userId+"> • "+week[0].score+" pts":"🌱 First gardener soon",inline:true},
      {name:"🌙 Top Month",value:month[0]?"<@"+month[0].userId+"> • "+month[0].score+" pts":"🌱 First gardener soon",inline:true}
    );
  }
  const buttons=new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("garden_panel:tree").setLabel("View Tree").setEmoji("🌳")
      .setStyle(panel==="tree"?ButtonStyle.Success:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("garden_panel:beds").setLabel("Garden Beds").setEmoji("🌼")
      .setStyle(panel==="beds"?ButtonStyle.Success:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("garden_panel:refresh:"+panel).setLabel("Refresh").setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel("Explore Website").setEmoji("🌐")
      .setStyle(ButtonStyle.Link).setURL(SITE_URL),
    new ButtonBuilder().setCustomId("garden_panel:guide").setLabel("How to Play").setEmoji("🌱")
      .setStyle(ButtonStyle.Secondary)
  );
  return {embeds:[embed],components:[buttons]};
}

export async function handleGardenViewButton(interaction:ButtonInteraction):Promise<void> {
  if (interaction.customId === "garden_panel:guide") {
    await interaction.reply({embeds:[gardenGuideEmbed()],ephemeral:true});
    return;
  }
  const guildId=interaction.guildId;
  if(!guildId || !(await gardenEnabled(guildId))) {
    await interaction.reply({content:"🌱 This garden isn't active yet.",ephemeral:true});
    return;
  }
  const mode=interaction.customId.split(":")[1];
  const panel:GardenPanel=mode==="beds"?"beds":
    mode==="refresh" && interaction.customId.endsWith(":beds")?"beds":"tree";
  await interaction.deferUpdate();
  await interaction.editReply(await renderGardenView(guildId,panel,interaction.guild));
}
