import {
  ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder,
} from "discord.js";
import {
  addGardenOrnament, gardenerStats, gardenEnabled, gardenLeaderboard,
  getGardenAnnouncementChannel, setGardenAnnouncementChannel,
  gardenPlants, getGardenOverview, harvestGardenPlant, plantGardenSeed,
  setGardenEnabled, waterGardenPlant,
  type GardenOrnament, type GardenPeriod, type GardenRanking, type GardenSpecies,
} from "../lib/gardenService";

const plants: {name:GardenSpecies; emoji:string}[] = [
  {name:"sunflower",emoji:"🌻"}, {name:"tulip",emoji:"🌷"},
  {name:"rose",emoji:"🌹"}, {name:"lavender",emoji:"🪻"},
  {name:"tomato",emoji:"🍅"}, {name:"carrot",emoji:"🥕"},
  {name:"pumpkin",emoji:"🎃"}, {name:"fern",emoji:"🌿"},
];
const ornaments: {name:GardenOrnament;emoji:string}[] = [
  {name:"star",emoji:"⭐"}, {name:"red_bauble",emoji:"🔴"},
  {name:"gold_bauble",emoji:"🟡"}, {name:"snowflake",emoji:"❄️"},
  {name:"ribbon",emoji:"🎀"}, {name:"lights",emoji:"✨"},
];
const plantEmoji = (name:string) => plants.find(x=>x.name===name)?.emoji ?? "🌱";

export const data = new SlashCommandBuilder()
  .setName("garden")
  .setDescription("Grow the shared Garden of Harmony tree, plants and holiday decorations")
  .addSubcommand(s=>s.setName("view").setDescription("View the whole server's shared garden"))
  .addSubcommand(s=>s.setName("leaderboard").setDescription("See live Top Gardeners, chatters or emoji reactors")
    .addStringOption(o=>o.setName("period").setDescription("Choose a time window")
      .setRequired(true).addChoices(
        {name:"Today (Central)",value:"day"},
        {name:"This week (Monday–Sunday)",value:"week"},
        {name:"This month",value:"month"}))
    .addStringOption(o=>o.setName("category").setDescription("What counts toward the ranking?")
      .addChoices(
        {name:"All garden actions",value:"all"},
        {name:"Chats",value:"chat"},
        {name:"Emoji reactions given",value:"reaction"})))
  .addSubcommand(s=>s.setName("plants").setDescription("See the newest community plants and who owns them"))
  .addSubcommand(s=>s.setName("plant").setDescription("Plant a flower, vegetable or fern (one per day)")
    .addStringOption(o=>o.setName("species").setDescription("What will you grow?").setRequired(true)
      .addChoices(...plants.map(p=>({name:p.emoji+" "+p.name,value:p.name})))))
  .addSubcommand(s=>s.setName("water").setDescription("Water your plant or someone else's (three per day)")
    .addIntegerOption(o=>o.setName("plant_id").setDescription("Plant ID from /garden plants").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("harvest").setDescription("Harvest your mature plant after three waterings")
    .addIntegerOption(o=>o.setName("plant_id").setDescription("Your mature plant ID").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("decorate").setDescription("Hang a Christmas decoration on the community tree")
    .addStringOption(o=>o.setName("ornament").setDescription("Choose your ornament").setRequired(true)
      .addChoices(...ornaments.map(p=>({name:p.emoji+" "+p.name.replace(/_/g," "),value:p.name})))))
  .addSubcommand(s=>s.setName("stats").setDescription("Your garden contribution, separate from chat XP")
    .addUserOption(o=>o.setName("member").setDescription("View another gardener's contributions")))
  .addSubcommand(s=>s.setName("setchannel").setDescription("[Staff] Choose a public channel for garden activity updates")
    .addChannelOption(o=>o.setName("channel").setDescription("Where Faye announces planting, watering, harvests and ornaments").setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
  .addSubcommand(s=>s.setName("enable").setDescription("[Staff] Start tracking community gardening"))
  .addSubcommand(s=>s.setName("disable").setDescription("[Staff] Pause garden tracking without deleting data"));

function topLine(entries: Awaited<ReturnType<typeof gardenLeaderboard>>) {
  return entries.length ? entries.map(e=>
    "**"+e.rank+".** <@"+e.userId+"> — **"+e.score+"**"
  ).join("\n") : "No contributions recorded yet 🌱";
}

const GARDEN_URL = "https://gardenofharmony.up.railway.app/garden";

/**
 * Broadcast successes, not errors. Members still get a private command receipt
 * while everyone who can see the chosen public channel sees Faye's announcement.
 * No @everyone, @here or role pings: this would overwhelm a large server.
 */
async function announceGarden(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  try {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const announcementChannelId = await getGardenAnnouncementChannel(guildId);
    if (announcementChannelId && interaction.guild) {
      const target = await interaction.guild.channels.fetch(announcementChannelId).catch(() => null);
      if (target && target.isTextBased() && "send" in target &&
          target.permissionsFor(interaction.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
        await target.send({ embeds: [embed], allowedMentions: { parse: [] } });
        return;
      }
      console.warn("Garden announcements: configured channel unavailable; using the command channel.");
    }
    // By default, post a second, public message where the command was used.
    await interaction.followUp({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    // Garden actions are already committed: a missed announcement must not
    // make successful planting/watering look like an error or award twice.
    console.error("Garden activity announcement failed:", error);
  }
}

function gardenUpdate(title: string, description: string, points: number) {
  return new EmbedBuilder()
    .setColor(0x78b987)
    .setTitle(title)
    .setDescription(description)
    .addFields({ name: "🌳 The Harmony Tree grew", value: "+" + points + " growth points", inline: true })
    .setFooter({ text: "Grown together in Garden of Harmony 🌿" })
    .setURL(GARDEN_URL)
    .setTimestamp();
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ephemeral:true});
  const guildId=interaction.guildId;
  if (!guildId) {await interaction.editReply("The community garden lives inside the server. 🌳");return;}
  const sub=interaction.options.getSubcommand();
  if (sub==="setchannel") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply("Only staff with **Manage Server** permission can choose the update channel.");
      return;
    }
    const selected = interaction.options.getChannel("channel", true);
    const guildChannel = interaction.guild?.channels.cache.get(selected.id);
    if (!interaction.guild || !guildChannel || !guildChannel.isTextBased() ||
        !guildChannel.permissionsFor(interaction.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
      await interaction.editReply("Please choose a channel that everyone in the server can view. 🌿");
      return;
    }
    await setGardenAnnouncementChannel(guildId, selected.id);
    await interaction.editReply("🌿 Garden updates will now be posted in <#" + selected.id +
      ">. Faye will announce planting, watering, harvesting and decorating there without pinging everyone.");
    return;
  }
  if (sub==="enable" || sub==="disable") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply("Only staff with **Manage Server** permission can do that.");
      return;
    }
    await setGardenEnabled(guildId,sub==="enable");
    await interaction.editReply(sub==="enable"
      ?"🌳 The Garden of Harmony is awake! Chat, give reactions, plant and water together. Garden tracking is separate from existing XP."
      :"🍂 Garden activity tracking is paused. Existing trees, plants, ornaments and scores are preserved.");
    return;
  }
  if (!(await gardenEnabled(guildId))) {
    await interaction.editReply("🌱 The shared garden is not active yet. Staff can run `/garden enable`.");
    return;
  }
  if (sub==="view") {
    const [g,day,week,month]=await Promise.all([
      getGardenOverview(guildId),
      gardenLeaderboard(guildId,"day","all",1),
      gardenLeaderboard(guildId,"week","all",1),
      gardenLeaderboard(guildId,"month","all",1),
    ]);
    const progress=g.nextAt===null ? "The tree has reached its legendary stage!"
      : (g.nextAt-g.points)+" growth points until the next stage ("+g.nextAt+" total).";
    const embed=new EmbedBuilder()
      .setTitle("🌳 "+g.treeName+" • "+g.name)
      .setColor(0x6da985)
      .setDescription("**"+g.points+" total growth points**\n"+progress+"\n"+
        "🌼 **"+g.livingPlants+"** living plants • 🎄 **"+g.ornaments+"** seasonal ornaments\n"+
        "🌿 **"+g.contributors+"** contributors • 💬 "+g.chatActions+" credited chats • 💚 "+g.reactions+" credited reactions")
      .addFields(
        {name:"🏆 Top Gardener Today",value:topLine(day),inline:true},
        {name:"📅 Top Gardener This Week",value:topLine(week),inline:true},
        {name:"🌙 Top Gardener This Month",value:topLine(month),inline:true}
      ).setFooter({text:"Rankings reset daily, weekly and monthly • America/Chicago • No XP/casino changes"});
    await interaction.editReply({embeds:[embed]});return;
  }
  if (sub==="leaderboard") {
    const period=interaction.options.getString("period",true) as GardenPeriod;
    const category=(interaction.options.getString("category")??"all") as GardenRanking;
    const top=await gardenLeaderboard(guildId,period,category,10);
    const label=category==="all"?"Top Gardeners":category==="chat"?"Most Chats":"Most Emoji Reactions Given";
    const embed=new EmbedBuilder().setColor(0x75bc8d)
      .setTitle("🏆 "+label+" • "+({day:"Today",week:"This Week",month:"This Month"}[period]))
      .setDescription(topLine(top))
      .setFooter({text:"Live credited actions • anti-spam cooldowns and daily limits • America/Chicago"});
    await interaction.editReply({embeds:[embed]});return;
  }
  if (sub==="plants") {
    const rows=await gardenPlants(guildId,15);
    const embed=new EmbedBuilder().setTitle("🌼 Community Garden Beds")
      .setColor(0x7baa8d)
      .setDescription(rows.length ? rows.map(p=>
        plantEmoji(p.species)+" **#"+p.id+" "+p.species+"** by <@"+p.owner_id+"> — "+
        p.water_count+"/3 waterings"+(p.water_count>=3?" ✅ Ready to harvest":"")
      ).join("\n") : "No plants yet. Grow the first one with `/garden plant`!")
      .setFooter({text:"Water anyone's plant • 3 waterings to mature"});
    await interaction.editReply({embeds:[embed]});return;
  }
  if (sub==="plant") {
    const species=interaction.options.getString("species",true) as GardenSpecies;
    const r=await plantGardenSeed(guildId,interaction.user.id,species);
    await interaction.editReply(r.status==="planted"
      ?plantEmoji(species)+" You planted **"+species+" #"+r.id+"**! Others can help by running `/garden water plant_id:"+r.id+"`."
      :r.status==="daily_limit"?"You've already planted today! Come back another day. 🌱"
      :"The garden is paused.");
    if (r.status==="planted") {
      await announceGarden(interaction, gardenUpdate(
        plantEmoji(species)+" A new "+species+" has been planted!",
        "<@"+interaction.user.id+"> planted **"+species+" #"+r.id+"** in our shared garden!\n"+
        "💧 Help it grow with `/garden water plant_id:"+r.id+"`.",
        5
      ));
    }
    return;
  }
  if (sub==="water") {
    const id=interaction.options.getInteger("plant_id",true);
    const r=await waterGardenPlant(guildId,interaction.user.id,id);
    await interaction.editReply(r.status==="watered"
      ?"💧 You watered "+plantEmoji(r.species)+" plant **#"+id+"** ("+r.waterCount+"/3)!"+
        (r.waterCount>=3?" It's ready for its owner to harvest!":"")
      :r.status==="already_watered"?"You've already watered this plant today. 💧"
      :r.status==="daily_limit"?"You've watered three plants today. Thanks for helping! 🌿"
      :r.status==="missing"?"That plant isn't available or has already been harvested."
      :"The garden is paused.");
    if (r.status==="watered") {
      await announceGarden(interaction, gardenUpdate(
        "💧 Someone watered the garden!",
        "<@"+interaction.user.id+"> watered "+plantEmoji(r.species)+" **"+r.species+" #"+id+"**!\n"+
        "🌱 **"+r.waterCount+"/3 waterings**"+
        (r.waterCount>=3?" — it's ready for its owner to harvest!":" — it's growing stronger!"),
        3
      ));
    }
    return;
  }
  if (sub==="harvest") {
    const id=interaction.options.getInteger("plant_id",true);
    const r=await harvestGardenPlant(guildId,interaction.user.id,id);
    await interaction.editReply(r.status==="harvested"
      ?"🧺 You harvested your "+plantEmoji(r.species)+" **"+r.species+"**! The shared tree grew by **5 points**."
      :"You can harvest only your own living plants after three waterings. 🌱");
    if (r.status==="harvested") {
      await announceGarden(interaction, gardenUpdate(
        "🧺 It's harvest time!",
        "<@"+interaction.user.id+"> harvested "+plantEmoji(r.species)+" **"+r.species+" #"+id+"**!\n"+
        "🌼 Thank you for helping our garden flourish.",
        5
      ));
    }
    return;
  }
  if (sub==="decorate") {
    const ornament=interaction.options.getString("ornament",true) as GardenOrnament;
    const r=await addGardenOrnament(guildId,interaction.user.id,ornament);
    const emoji=ornaments.find(o=>o.name===ornament)?.emoji??"🎄";
    await interaction.editReply(r.status==="added"
      ?emoji+" Your **"+ornament.replace(/_/g," ")+"** now decorates the server's Harmony Tree!"
      :r.status==="out_of_season"?"🎄 Holiday decorating is available November–January."
      :"You've already decorated today, or you've placed this decoration this season.");
    if (r.status==="added") {
      await announceGarden(interaction, gardenUpdate(
        "🎄 The Harmony Tree has a new decoration!",
        "<@"+interaction.user.id+"> hung "+emoji+" **"+ornament.replace(/_/g," ")+"** on our holiday tree!\n"+
        "✨ Look for it on the live website.",
        3
      ));
    }
    return;
  }
  if (sub==="stats") {
    const target=interaction.options.getUser("member")??interaction.user;
    const stats=await gardenerStats(guildId,target.id);
    await interaction.editReply("🌱 **<@"+target.id+">'s Garden Contributions**\n"+
      "🌳 **"+stats.points+"** growth points\n💬 **"+stats.chats+"** credited chats\n"+
      "💚 **"+stats.reactions+"** emoji reactions given\n🌻 **"+stats.plants+"** plants planted\n"+
      "_Separate from existing XP and casino currency._");
    return;
  }
}
