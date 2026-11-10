import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
  ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder,
  StringSelectMenuBuilder, StringSelectMenuInteraction,
} from "discord.js";
import {
  addGardenOrnament, gardenerStats, gardenEnabled, gardenLeaderboard,
  getGardenAnnouncementChannel, setGardenAnnouncementChannel,
  gardenPlants, getGardenOverview, harvestGardenPlant, harvestableGardenPlants, plantGardenSeed,
  setGardenEnabled, waterGardenPlant, waterableGardenPlants,
  type GardenOrnament, type GardenPeriod, type GardenRanking, type GardenSpecies,
} from "../lib/gardenService";
import { currentGardenHoliday, decorationEmoji } from "../lib/gardenSeasons";
import { availableGardenPlants, currentPlantSeason, isPlantAvailable,
  plantEmoji, plantLabel as speciesName, plantMenuEmoji } from "../lib/gardenPlantsCatalog";
import { renderGardenView } from "../lib/gardenView";
import { gardenGuideEmbed } from "../lib/gardenGuide";
import { GARDEN_BADGES, getGardenerProgress } from "../lib/gardenAchievements";

const ornaments: {name:GardenOrnament;emoji:string}[] = Object.entries(decorationEmoji).map(([name,emoji])=>({name:name as GardenOrnament,emoji}));

export const data = new SlashCommandBuilder()
  .setName("garden")
  .setDescription("Grow the shared Garden of Harmony tree, plants and holiday decorations")
  .addSubcommand(s=>s.setName("view").setDescription("Show a live picture of the tree and garden to everyone"))
  .addSubcommand(s=>s.setName("guide").setDescription("Learn how to grow our community garden"))
  .addSubcommand(s=>s.setName("profile").setDescription("Share a gardener's profile and achievements")
    .addUserOption(o=>o.setName("member").setDescription("Whose profile? Defaults to yours")))
  .addSubcommand(s=>s.setName("badges").setDescription("Check your earned gardening badges and progress")
    .addUserOption(o=>o.setName("member").setDescription("Whose badges? Defaults to yours")))
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
  .addSubcommand(s=>s.setName("plant").setDescription("Pick a seasonal seed from a private emoji menu (one per day)"))
  .addSubcommand(s=>s.setName("water").setDescription("Choose a gardener's plant to water (3/day)")
    .addUserOption(o=>o.setName("member").setDescription("Whose plant? Defaults to yours")))
  .addSubcommand(s=>s.setName("harvest").setDescription("Choose one of your ready-to-harvest plants"))
  .addSubcommand(s=>s.setName("decorate").setDescription("Add a decoration for the current holiday or season")
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
const GARDEN_SCENE_URL = "https://garden-of-harmony-migration-production.up.railway.app/api/garden-scene";

/**
 * Public successes go to the configured channel (or the command channel).
 * Only the explicitly watered plant's owner may be pinged; no role pings.
 */
async function announceGarden(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  embed: EmbedBuilder,
  pingOwnerId?: string
): Promise<void> {
  try {
    if (!interaction.guildId || !interaction.guild) return;
    const configuredId = await getGardenAnnouncementChannel(interaction.guildId);
    const configured = configuredId
      ? await interaction.guild.channels.fetch(configuredId).catch(() => null) : null;
    const fallback = interaction.channelId
      ? await interaction.guild.channels.fetch(interaction.channelId).catch(() => null) : null;
    const channels = [configured, fallback];
    for (const channel of channels) {
      if (channel && channel.isTextBased() && "send" in channel &&
        channel.permissionsFor(interaction.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
        await channel.send({
          embeds: [embed],
          allowedMentions: pingOwnerId ? { users: [pingOwnerId] } : { parse: [] },
        });
        return;
      }
    }
    console.warn("Garden announcement channel was not publicly accessible.");
  } catch (error) {
    console.error("Garden activity announcement failed:", error);
  }
}

function gardenUpdate(title: string, description: string, points: number, view: "tree" | "beds" = "tree") {
  return new EmbedBuilder()
    .setColor(0x78b987)
    .setTitle(title)
    .setDescription(description)
    .addFields({ name: "🌳 The Harmony Tree grew", value: "+" + points + " growth points", inline: true })
    .setFooter({ text: "Grown together in Garden of Harmony 🌿" })
    .setURL(GARDEN_URL)
    .setImage(GARDEN_SCENE_URL + "?view=" + view + "&v=" + Date.now())
    .setTimestamp();
}

const WATER_PAGE_SIZE = 25;
const HARVEST_PAGE_SIZE = 25;

function plantLabel(species: string, plantedAt: Date | string): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric",
  }).format(new Date(plantedAt));
  return speciesName(species) + " • planted " + date;
}

/** A simple private seed picker: eight year-round plus four seasonal choices. */
async function showPlantPicker(interaction: ChatInputCommandInteraction): Promise<void> {
  const season = currentPlantSeason();
  const select = new StringSelectMenuBuilder()
    .setCustomId("garden_plant:pick:" + interaction.user.id)
    .setPlaceholder("Which seed would you like to plant? 🌱")
    .addOptions(availableGardenPlants().map(plant => ({
      label: plant.label,
      value: plant.key,
      description: plant.season === "all" ? "Available year-round" : "Limited to " + season,
      emoji: plantMenuEmoji(plant.key, interaction.guild),
    })));
  await interaction.editReply({
    content: "🌱 **Choose your seed!** " + season[0].toUpperCase() + season.slice(1) +
      " plants are here for a limited time. You can keep watering and harvest them after the season changes." +
      "\nOne new seed per day.",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  });
}

async function completePlant(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  guildId: string, species: GardenSpecies
): Promise<void> {
  const result = await plantGardenSeed(guildId, interaction.user.id, species);
  const message = result.status === "planted"
    ? plantEmoji(species, interaction.guild) + " You planted a **" + speciesName(species) + "**! 💚 Friends can help it grow with `/garden water` and by choosing your name."
    : result.status === "daily_limit"
      ? "🌱 You've already planted today! Come back tomorrow for another seed."
      : result.status === "out_of_season" ? "🍂 That seed is out of season. Run /garden plant for today’s choices."
      : "🌱 The garden is paused.";
  if (interaction.isStringSelectMenu()) {
    await interaction.update({ content: message, components: [] });
  } else {
    await interaction.editReply({ content: message, components: [] });
  }
  if (result.status === "planted") {
    await announceGarden(interaction, gardenUpdate(
      plantEmoji(species, interaction.guild) + " A new " + speciesName(species) + " has been planted!",
      "<@" + interaction.user.id + "> planted a " + plantEmoji(species, interaction.guild) + " **" + speciesName(species) + "** in our shared garden!\n" +
      "💧 To help it grow, use `/garden water`, select this gardener, and pick the plant.",
      5, "beds"
    ));
  }
}

/** Show only the member's mature, unharvested plants. */
async function showHarvestPicker(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guildId: string, page: number
): Promise<void> {
  const ready = await harvestableGardenPlants(guildId, interaction.user.id, page * HARVEST_PAGE_SIZE, HARVEST_PAGE_SIZE + 1);
  const options = ready.slice(0, HARVEST_PAGE_SIZE);
  const rows: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];
  if (options.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("garden_harvest:pick:" + interaction.user.id + ":" + page)
      .setPlaceholder("Choose a plant to harvest 🧺")
      .addOptions(options.map(plant => ({
        label: plantLabel(plant.species, plant.planted_at),
        description: "Ready to harvest • 3/3 waterings",
        value: plant.id,
        emoji: plantMenuEmoji(plant.species, interaction.guild),
      })));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }
  if (page > 0 || ready.length > HARVEST_PAGE_SIZE) {
    const previous = new ButtonBuilder()
      .setCustomId("garden_harvest:page:" + interaction.user.id + ":" + (page - 1))
      .setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
    const next = new ButtonBuilder()
      .setCustomId("garden_harvest:page:" + interaction.user.id + ":" + (page + 1))
      .setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(ready.length <= HARVEST_PAGE_SIZE);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(previous, next));
  }
  const reply = {
    content: options.length
      ? "🧺 **Which plant would you like to harvest?** (page " + (page + 1) + ")"
      : "🌱 You have no plants ready to harvest on this page. Each plant needs three waterings first!",
    components: rows,
  };
  if (interaction.isChatInputCommand()) await interaction.editReply(reply);
  else await interaction.update(reply);
}

async function completeHarvest(
  interaction: StringSelectMenuInteraction, guildId: string, id: number
): Promise<void> {
  const result = await harvestGardenPlant(guildId, interaction.user.id, id);
  await interaction.update({
    content: result.status === "harvested"
      ? "🧺 You harvested your " + plantEmoji(result.species, interaction.guild) + " **" + speciesName(result.species) + "**! The Harmony Tree grew by **5 points**."
      : "🌱 That plant is no longer ready to harvest. Try `/garden harvest` to refresh your list.",
    components: [],
  });
  if (result.status === "harvested") {
    await announceGarden(interaction, gardenUpdate(
      "🧺 It's harvest time!",
      "<@" + interaction.user.id + "> harvested a " + plantEmoji(result.species, interaction.guild) + " **" + speciesName(result.species) + "**!\n" +
      "🌼 Thank you for helping our garden flourish.",
      5, "beds"
    ));
  }
}
type WaterInteraction = ChatInputCommandInteraction | StringSelectMenuInteraction;

/** Select one of the tagged member's eligible plants, without looking up IDs. */
async function showWaterPicker(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guildId: string, ownerId: string, page: number
): Promise<void> {
  const plantsForOwner = await waterableGardenPlants(guildId, ownerId, page * WATER_PAGE_SIZE, WATER_PAGE_SIZE + 1);
  const options = plantsForOwner.slice(0, WATER_PAGE_SIZE);
  const base = "garden_water:";
  const rows: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];
  if (options.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(base + "pick:" + interaction.user.id + ":" + ownerId + ":" + page)
      .setPlaceholder("Choose a plant to water 💧")
      .addOptions(options.map(plant => ({
        label: plantLabel(plant.species, plant.planted_at),
        description: plant.water_count + "/3 waterings • " + (3-plant.water_count) + " left to mature",
        value: plant.id,
        emoji: plantMenuEmoji(plant.species, interaction.guild),
      })));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }
  if (page > 0 || plantsForOwner.length > WATER_PAGE_SIZE) {
    const previous = new ButtonBuilder()
      .setCustomId(base + "page:" + interaction.user.id + ":" + ownerId + ":" + (page - 1))
      .setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
    const next = new ButtonBuilder()
      .setCustomId(base + "page:" + interaction.user.id + ":" + ownerId + ":" + (page + 1))
      .setLabel("Next").setStyle(ButtonStyle.Secondary)
      .setDisabled(plantsForOwner.length <= WATER_PAGE_SIZE);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(previous, next));
  }
  const content = options.length
    ? "💧 Choose one of <@" + ownerId + ">'s plants to water (page " + (page+1) + ")."
    : "🌱 <@" + ownerId + "> has no plants that need water right now. They can plant with `/garden plant`!";
  const reply = { content, components: rows, allowedMentions: { parse: [] as Array<"users" | "roles" | "everyone"> } };
  if (interaction.isChatInputCommand()) await interaction.editReply(reply);
  else await interaction.update(reply);
}

async function completeWater(
  interaction: WaterInteraction, guildId: string, id: number, expectedOwnerId?: string
): Promise<void> {
  const r = await waterGardenPlant(guildId, interaction.user.id, id, expectedOwnerId);
  const message = r.status === "watered"
    ? "💧 You watered <@" + r.ownerId + ">'s " + plantEmoji(r.species, interaction.guild) +
      " **" + speciesName(r.species) + "** (" + r.waterCount + "/3)!" +
      (r.waterCount >= 3 ? " It's ready for its owner to harvest! 🧺" : " It's growing! 🌿") +
      " **+" + r.points + " growth points!**" +
      (r.firstHelpBonus ? " 🌸 Includes a +2 first-help bonus for this gardener today!" : "")
    : r.status === "already_watered" ? "You've already watered this plant today. 💧"
    : r.status === "daily_limit" ? "You've watered three plants today. Thanks for helping! 🌿"
    : r.status === "mature" ? "🌼 That plant is fully watered and ready for its owner to harvest!"
    : r.status === "wrong_owner" ? "That plant doesn't belong to the member you selected. Choose from their menu instead."
    : r.status === "missing" ? "That plant isn't available or has already been harvested."
    : "The garden is paused.";
  if (interaction.isStringSelectMenu()) {
    await interaction.update({ content: message, components: [], allowedMentions: { parse: [] } });
  } else {
    await interaction.editReply(message);
  }
  if (r.status === "watered") {
    await announceGarden(interaction, gardenUpdate(
      r.ownerId === interaction.user.id ? "💧 A gardener tended their plant!" : "💧 A garden neighbor helped a friend!",
      "<@" + interaction.user.id + "> watered <@" + r.ownerId + ">'s " + plantEmoji(r.species, interaction.guild) +
        " **" + speciesName(r.species) + "**!\n" +
        "🌱 **" + r.waterCount + "/3 waterings**" +
        (r.waterCount >= 3 ? " — ready for harvest! 🧺" : " — growing stronger!") +
        "\n🌿 **+" + r.points + " growth points**" +
        (r.firstHelpBonus ? " (including +2 for helping this gardener for the first time today!)" : ""),
      r.points, "beds"
    ), r.ownerId !== interaction.user.id ? r.ownerId : undefined);
  }
}

/** Used by the shared interaction router for the ephemeral plant picker. */
export async function handleGardenWaterInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
): Promise<void> {
  const [prefix, action, actorId, ownerId, pageText] = interaction.customId.split(":");
  if (prefix !== "garden_water" || !actorId || !ownerId || !/^\d+$/.test(ownerId)) {
    await interaction.reply({ content: "That garden menu is invalid. Please use `/garden water` again.", ephemeral: true });
    return;
  }
  if (interaction.user.id !== actorId) {
    await interaction.reply({ content: "🌱 This watering menu belongs to another gardener. Run `/garden water` to open yours.", ephemeral: true });
    return;
  }
  if (!interaction.guildId || !(await gardenEnabled(interaction.guildId))) {
    await interaction.update({ content: "🌱 The garden is not active right now.", components: [] });
    return;
  }
  if (action === "page" && interaction.isButton()) {
    const page = Number(pageText);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) {
      await interaction.reply({ content: "That page isn't available.", ephemeral: true });
      return;
    }
    await showWaterPicker(interaction, interaction.guildId, ownerId, page);
    return;
  }
  if (action === "pick" && interaction.isStringSelectMenu()) {
    const id = Number(interaction.values[0]);
    if (!Number.isSafeInteger(id) || id < 1) {
      await interaction.reply({ content: "That plant isn't available. Run `/garden water` again.", ephemeral: true });
      return;
    }
    await completeWater(interaction, interaction.guildId, id, ownerId);
    return;
  }
  await interaction.reply({ content: "That watering menu expired. Run `/garden water` again.", ephemeral: true });
}

/** Keep the seed menu private to the member who opened it. */
export async function handleGardenPlantInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  const [prefix, action, actorId] = interaction.customId.split(":");
  if (prefix !== "garden_plant" || action !== "pick" || !actorId || interaction.user.id !== actorId) {
    await interaction.reply({ content: "🌱 This seed picker belongs to another gardener. Run `/garden plant` to open your own.", ephemeral: true });
    return;
  }
  if (!interaction.guildId || !(await gardenEnabled(interaction.guildId))) {
    await interaction.update({ content: "🌱 The garden is not active right now.", components: [] });
    return;
  }
  const species = interaction.values[0];
  if (!isPlantAvailable(species)) {
    await interaction.reply({ content: "That seed isn't available. Run `/garden plant` again.", ephemeral: true });
    return;
  }
  await completePlant(interaction, interaction.guildId, species as GardenSpecies);
}

/** Paging and selecting harvests never expose an ID to the gardener. */
export async function handleGardenHarvestInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
): Promise<void> {
  const [prefix, action, actorId, pageText] = interaction.customId.split(":");
  if (prefix !== "garden_harvest" || !actorId || !/^\d+$/.test(actorId) || interaction.user.id !== actorId) {
    await interaction.reply({ content: "🧺 This harvest menu belongs to another gardener. Run `/garden harvest` to open yours.", ephemeral: true });
    return;
  }
  if (!interaction.guildId || !(await gardenEnabled(interaction.guildId))) {
    await interaction.update({ content: "🌱 The garden is not active right now.", components: [] });
    return;
  }
  if (action === "page" && interaction.isButton()) {
    const page = Number(pageText);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) {
      await interaction.reply({ content: "That page isn't available.", ephemeral: true });
      return;
    }
    await showHarvestPicker(interaction, interaction.guildId, page);
    return;
  }
  if (action === "pick" && interaction.isStringSelectMenu()) {
    const id = Number(interaction.values[0]);
    if (!Number.isSafeInteger(id) || id < 1) {
      await interaction.reply({ content: "That plant isn't available. Run `/garden harvest` again.", ephemeral: true });
      return;
    }
    await completeHarvest(interaction, interaction.guildId, id);
    return;
  }
  await interaction.reply({ content: "That harvest menu expired. Run `/garden harvest` again.", ephemeral: true });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub=interaction.options.getSubcommand();
  await interaction.deferReply({ephemeral:sub!=="view" && sub!=="profile"});
  const guildId=interaction.guildId;
  if (!guildId) {await interaction.editReply("The community garden lives inside the server. 🌳");return;}
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
    await interaction.editReply(await renderGardenView(guildId, "tree", interaction.guild));
    return;
  }
  if (sub==="guide") {
    await interaction.editReply({embeds:[gardenGuideEmbed()]});
    return;
  }
  if (sub==="profile" || sub==="badges") {
    const target = interaction.options.getUser("member") ?? interaction.user;
    const {totals, earned, favorite} = await getGardenerProgress(guildId, target.id);
    if (sub==="profile") {
      const badges = earned.length
        ? earned.map(b=>b.emoji+" "+b.name).join("  •  ")
        : "🌱 No badges yet — your first seed is waiting!";
      const embed = new EmbedBuilder()
        .setColor(0x7ab68e)
        .setAuthor({name:target.displayName+" • Garden of Harmony",iconURL:target.displayAvatarURL()})
        .setTitle("🌸 Gardener Profile")
        .setDescription("**"+totals.points.toLocaleString()+" growth points** contributed to the Harmony Tree!\n"+
          "**Favorite activity:** "+favorite)
        .addFields(
          {name:"🌻 Growing together",value:"🌱 "+totals.plants+" planted  •  💧 "+totals.waterings+" watered\n"+
            "🧺 "+totals.harvests+" harvested  •  🎀 "+totals.ornaments+" decorations"},
          {name:"💬 Community kindness",value:"💬 "+totals.chats+" eligible chats  •  💚 "+totals.reactions+" reactions"},
          {name:"🏅 Badges ("+earned.length+"/"+GARDEN_BADGES.length+")",value:badges}
        )
        .setThumbnail(target.displayAvatarURL({size:256}))
        .setImage(GARDEN_SCENE_URL+"?view=tree&v="+Date.now())
        .setURL(GARDEN_URL)
        .setFooter({text:"Share this card • /garden badges for progress • Separate from XP"});
      await interaction.editReply({embeds:[embed],allowedMentions:{parse:[]}});
    } else {
      const lines = GARDEN_BADGES.map(b=>{
        const value=totals[b.stat];
        const unlocked=value>=b.goal;
        return (unlocked?"✅ ":"🔒 ")+b.emoji+" **"+b.name+"** — "+
          (unlocked?"Unlocked!":Math.min(value,b.goal)+"/"+b.goal)+
          "\n"+b.description;
      });
      const embed = new EmbedBuilder().setColor(0x85b992)
        .setTitle("🏅 "+target.displayName+"'s Gardening Badges")
        .setDescription("**"+earned.length+"/"+GARDEN_BADGES.length+" unlocked**\n\n"+lines.join("\n\n"))
        .setFooter({text:"Badges unlock automatically through credited garden contributions"});
      await interaction.editReply({embeds:[embed]});
    }
    return;
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
    const rows = await gardenPlants(guildId, 15);
    const embed = new EmbedBuilder().setTitle("🌼 Community Garden Beds")
      .setColor(0x7baa8d)
      .setDescription(rows.length ? rows.map(plant =>
        plantEmoji(plant.species, interaction.guild) + " **" + plantLabel(plant.species, plant.planted_at) + "** by <@" +
        plant.owner_id + "> — " + plant.water_count + "/3 waterings" +
        (plant.water_count >= 3 ? " ✅ Ready to harvest" : "")
      ).join("\n") : "No plants yet. Grow the first one with `/garden plant`!")
      .setFooter({ text: "Water a friend's plant with /garden water @member • No IDs needed" });
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  if (sub==="plant") {
    await showPlantPicker(interaction);
    return;
  }
  if (sub==="water") {
    const member = interaction.options.getUser("member");
    await showWaterPicker(interaction, guildId, member?.id ?? interaction.user.id, 0);
    return;
  }
  if (sub==="harvest") {
    await showHarvestPicker(interaction, guildId, 0);
    return;
  }
  if (sub==="decorate") {
    const ornament=interaction.options.getString("ornament",true) as GardenOrnament;
    const r=await addGardenOrnament(guildId,interaction.user.id,ornament);
    const emoji=ornaments.find(o=>o.name===ornament)?.emoji??"🎄";
    await interaction.editReply(r.status==="added"
      ?emoji+" Your **"+ornament.replace(/_/g," ")+"** now decorates the "+r.holiday+"!"
      :r.status==="out_of_season"?"🎊 That decoration does not fit the current "+currentGardenHoliday().name+". Try: "+currentGardenHoliday().allowed.map(d=>decorationEmoji[d]+" "+d.replace(/_/g," ")).join(", ")
      :"You've already decorated today, or you've placed this decoration this season.");
    if (r.status==="added") {
      await announceGarden(interaction, gardenUpdate(
        currentGardenHoliday().emoji+" A new seasonal decoration!",
        "<@"+interaction.user.id+"> hung "+emoji+" **"+ornament.replace(/_/g," ")+"** in the "+r.holiday+"!\n"+
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
