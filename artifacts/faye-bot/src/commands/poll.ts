import {
  type Attachment,
  type ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { pool } from "../lib/database";
import {
  importPolls,
  parsePoll,
  pollConfig,
  postPoll,
  setChannel,
  setTime,
  localParts,
} from "../lib/pollService";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Garden of Harmony's daily polls")
  .addSubcommand(s => s.setName("suggest").setDescription("Suggest a poll for staff approval")
    .addStringOption(o => o.setName("poll").setDescription("Question | Answer 1 | Answer 2 ...")
      .setRequired(true).setMaxLength(1000)))
  .addSubcommand(s => s.setName("add").setDescription("[Staff] Add an approved poll")
    .addStringOption(o => o.setName("poll").setDescription("Question | Answer 1 | Answer 2 ...")
      .setRequired(true).setMaxLength(1000)))
  .addSubcommand(s => s.setName("batch").setDescription("[Staff] Add multiple approved polls")
    .addStringOption(o => o.setName("polls").setDescription("One poll per line; choices separated by |")
      .setRequired(true).setMaxLength(6000)))
  .addSubcommand(s => s.setName("import").setDescription("[Staff] Import a text file of approved polls")
    .addAttachmentOption(o => o.setName("file").setDescription("UTF-8 .txt; one poll per line; up to 64 KB")
      .setRequired(true)))
  .addSubcommand(s => s.setName("seed").setDescription("[Staff] Add 35 starter polls automatically"))
  .addSubcommand(s => s.setName("queue").setDescription("[Staff] View approved unused polls")
    .addIntegerOption(o => o.setName("page").setDescription("Page (10 results)").setMinValue(1)))
  .addSubcommand(s => s.setName("pending").setDescription("[Staff] View pending member suggestions")
    .addIntegerOption(o => o.setName("page").setDescription("Page (10 results)").setMinValue(1)))
  .addSubcommand(s => s.setName("history").setDescription("[Staff] View past daily polls")
    .addIntegerOption(o => o.setName("page").setDescription("Page (10 results)").setMinValue(1)))
  .addSubcommand(s => s.setName("approve").setDescription("[Staff] Approve a suggested poll")
    .addIntegerOption(o => o.setName("id").setDescription("Poll ID").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("reject").setDescription("[Staff] Delete a pending suggestion")
    .addIntegerOption(o => o.setName("id").setDescription("Poll ID").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("remove").setDescription("[Staff] Delete an unused poll")
    .addIntegerOption(o => o.setName("id").setDescription("Poll ID").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("post").setDescription("[Staff] Post one approved poll now (uses today's slot)")
    .addIntegerOption(o => o.setName("id").setDescription("Approved unused poll ID").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("channel").setDescription("[Staff] Choose the daily poll text channel")
    .addChannelOption(o => o.setName("channel").setDescription("The dedicated #daily-polls channel")
      .addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand(s => s.setName("time").setDescription("[Staff] Change the daily poll time (Central)")
    .addStringOption(o => o.setName("time").setDescription("24-hour HH:MM (e.g. 10:00)")
      .setMinLength(5).setMaxLength(5).setRequired(true)))
  .addSubcommand(s => s.setName("status").setDescription("[Staff] View poll schedule and queue counts"));

export const SEED_POLLS = [
  "Which magical ability would be the most inconvenient? | Talking to pigeons | Glowing when embarrassed | Floating 2 inches | Predicting sneezes",
  "Which cozy evening wins? | Reading under a blanket | Gaming with snacks | Comfort show marathon | Crafting and music",
  "One animal becomes your legal advisor. Who? | Cat | Raccoon | Crow | Capybara",
  "If your brain had a loading screen, what would it say? | Please wait | Side quests detected | Too many tabs | Have you tried snacks?",
  "Pick an Avatar bending style! | Water | Earth | Fire | Air",
  "You can only keep one fictional travel method. | Appa | Flying broom | Portal | Dragon",
  "Your villain origin story begins with... | Missing fries | A group project | A printer jam | Someone moving your stuff",
  "Best kind of game night? | Party games | Cozy co-op | Mystery games | Trivia",
  "Which fantasy companion would you pick? | Dragon | Phoenix | Familiar cat | Talking sword",
  "What would you rather summon once per day? | Perfect coffee | Fresh socks | A tiny cloud | One free pizza",
  "Your NPC catchphrase is... | I have a quest for you | Need more inventory | Have you saved? | I know a shortcut",
  "Which tiny annoyance would you ban forever? | Wet socks | Low phone battery | Loud chewing | Tangled cords",
  "Which fictional world would you visit for a weekend? | Avatar | Middle-earth | Hogwarts | Stardew Valley",
  "Would you rather... | Fight one horse-sized duck | Fight 100 duck-sized horses",
  "Choose a useless superpower. | Perfectly peel oranges | Find one penny daily | Speak to squirrels | Refill any pen",
  "What is your ideal rainy-day sound? | Rain on windows | Thunder | Fireplace | Quiet music",
  "If a raccoon knocked at your door, you would... | Invite it in | Offer snacks | Ask for rent | Pretend not to be home",
  "Which fictional job seems surprisingly fun? | Potion seller | Dragon keeper | Guild librarian | Side-quest giver",
  "What is the superior snack shape? | Triangle | Circle | Stick | Mystery blob",
  "Choose your main character flaw. | Hoards loot | Talks to every NPC | Skips tutorials | Gets distracted by pets",
  "How many browser tabs are too many? | 5 | 20 | 50 | There is no limit",
  "Best low-pressure community event? | Parallel play | Book club | Craft night | Movie night",
  "If you could rename Monday, what would it be? | Second Sunday | Whyday | Pre-Tuesday | Chaos Eve",
  "Which season has the best overall vibe? | Spring | Summer | Fall | Winter",
  "What should a wizard conjure at a party? | Unlimited cheese | Glitter-free confetti | Cozy chairs | Tiny dragons",
  "Which element fits your mood today? | Water | Earth | Fire | Air",
  "If your life had a difficulty setting, it would be... | Story mode | Normal | Survival | Custom chaos",
  "Which mysterious door do you open first? | Glowing forest | Underwater library | Floating castle | Hidden garden",
  "Would you rather own... | A polite ghost | A tiny dragon | A sentient plant | A very dramatic owl",
  "What deserves a national holiday? | Naps | Pet appreciation | Finishing a book | Cancelled meetings",
  "Most chaotic mascot for Garden of Harmony? | Sleepy cat | Caffeinated frog | Wise raccoon | Dancing mushroom",
  "Which would be your comfort side quest? | Collecting flowers | Feeding creatures | Exploring ruins | Finding books",
  "What would be hardest to give up for one week? | Music | Games | Books | Streaming",
  "Best fantasy home? | Mushroom cottage | Treehouse | Floating island | Castle library",
  "How should Faye greet the server? | Gentle wave | Dramatic entrance | Tiny confetti | Silent thumbs-up",
].join("\n");

async function readAttachment(file: Attachment): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".txt") || file.size > 64 * 1024) {
    throw Error("Upload a UTF-8 .txt file under 64 KB.");
  }
  const response = await fetch(file.url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error("Unable to download the file from Discord.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 64 * 1024) throw Error("File too large (64 KB maximum).");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply("Use /poll in a Discord server.");
    return;
  }

  const sub = interaction.options.getSubcommand();
  try {
    if (sub === "suggest") {
      const parsed = parsePoll(interaction.options.getString("poll", true));
      const result = await importPolls(
        guildId,
        interaction.user.id,
        [parsed.question, ...parsed.answers].join(" | "),
        false
      );
      await interaction.editReply(
        result.added ? "🌱 Your poll has been submitted for staff approval!" :
        "This poll has already been suggested or used."
      );
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply("Only staff with Manage Server permission can manage polls. 🌿");
      return;
    }

    if (["add", "batch", "import", "seed"].includes(sub)) {
      const input = sub === "add" ? interaction.options.getString("poll", true)
        : sub === "batch" ? interaction.options.getString("polls", true)
        : sub === "import" ? await readAttachment(interaction.options.getAttachment("file", true))
        : SEED_POLLS;
      const result = await importPolls(guildId, interaction.user.id, input, true);
      let reply = "✅ **" + result.added + " polls added and automatically approved!**" +
        "\n🔁 " + result.duplicates + " duplicates skipped (including already-used polls).";
      if (result.invalid.length) {
        reply += "\n⚠️ " + result.invalid.length + " invalid lines:\n" +
          result.invalid.slice(0, 8).join("\n");
      }
      await interaction.editReply(reply);
      return;
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      if (channel.type !== ChannelType.GuildText) throw Error("Select a text channel.");
      await setChannel(guildId, channel.id);
      await interaction.editReply("🗳️ Faye's daily polls will post in <#" + channel.id + ">.");
      return;
    }

    if (sub === "time") {
      const value = interaction.options.getString("time", true);
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw Error("Use 24-hour time HH:MM, such as 10:00.");
      }
      const [hour, minute] = value.split(":").map(Number);
      await setTime(guildId, hour, minute);
      await interaction.editReply("🕒 Polls will post at **" + value + " America/Chicago**.");
      return;
    }

    if (sub === "status") {
      const config = await pollConfig(guildId);
      const result = await pool.query<{
        unused: string; pending: string; used: string;
      }>(
        "SELECT COUNT(*) FILTER (WHERE approved AND NOT used)::text AS unused, " +
        "COUNT(*) FILTER (WHERE NOT approved AND NOT used)::text AS pending, " +
        "COUNT(*) FILTER (WHERE used)::text AS used " +
        "FROM faye_poll_entries WHERE guild_id=$1",
        [guildId]
      );
      const daily = await pool.query<{ message_id: string | null }>(
        "SELECT message_id FROM faye_daily_poll_posts WHERE guild_id=$1 AND local_date=$2",
        [guildId, localParts().date]
      );
      const time = String(config?.post_hour ?? 10).padStart(2, "0") + ":" +
        String(config?.post_minute ?? 0).padStart(2, "0");
      await interaction.editReply(
        "🗳️ **Daily poll status**\n" +
        "Channel: " + (config?.channel_id ? "<#" + config.channel_id + ">" : "Not configured") +
        "\nTime: **" + time + " America/Chicago**" +
        "\nApproved, unused: **" + result.rows[0]?.unused + "**" +
        "\nPending suggestions: **" + result.rows[0]?.pending + "**" +
        "\nPreviously used: **" + result.rows[0]?.used + "**" +
        "\nToday: " + (!daily.rows.length ? "Not posted" :
          daily.rows[0].message_id ? "Posted ✅" : "Claimed; check logs ⚠️")
      );
      return;
    }

    if (["queue", "pending", "history"].includes(sub)) {
      const page = interaction.options.getInteger("page") ?? 1;
      const offset = (page - 1) * 10;
      let rows: { id: number; question: string; date?: string }[];
      let count: number;
      if (sub === "history") {
        const found = await pool.query<{ id: number; question: string; date: string }>(
          "SELECT e.id,e.question,h.local_date AS date FROM faye_daily_poll_posts h " +
          "JOIN faye_poll_entries e ON e.id=h.poll_id " +
          "WHERE h.guild_id=$1 ORDER BY h.local_date DESC LIMIT 10 OFFSET $2",
          [guildId, offset]
        );
        rows = found.rows;
        const total = await pool.query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM faye_daily_poll_posts WHERE guild_id=$1",
          [guildId]
        );
        count = Number(total.rows[0].n);
      } else {
        const state = sub === "queue" ? "approved=TRUE" : "approved=FALSE";
        const found = await pool.query<{ id: number; question: string }>(
          "SELECT id,question FROM faye_poll_entries WHERE guild_id=$1 AND used=FALSE AND " +
          state + " ORDER BY id LIMIT 10 OFFSET $2",
          [guildId, offset]
        );
        rows = found.rows;
        const total = await pool.query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM faye_poll_entries WHERE guild_id=$1 AND used=FALSE AND " +
          state,
          [guildId]
        );
        count = Number(total.rows[0].n);
      }
      const label = sub === "queue" ? "Approved queue" :
        sub === "pending" ? "Pending suggestions" : "Poll history";
      const maxPage = Math.max(1, Math.ceil(count / 10));
      const embed = new EmbedBuilder()
        .setTitle("🌸 " + label)
        .setColor(0x79bb92)
        .setDescription(rows.length
          ? rows.map(r => "**#" + r.id + "** — " + r.question.slice(0, 180) +
            (r.date ? " · " + r.date : "")).join("\n\n")
          : "Nothing on this page.")
        .setFooter({ text: "Page " + page + "/" + maxPage +
          " · " + count + " total · use /poll " + sub + " page:" + (page + 1) });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (["approve", "reject", "remove"].includes(sub)) {
      const id = interaction.options.getInteger("id", true);
      if (sub === "approve") {
        const updated = await pool.query(
          "UPDATE faye_poll_entries SET approved=TRUE " +
          "WHERE guild_id=$1 AND id=$2 AND approved=FALSE AND used=FALSE RETURNING id",
          [guildId, id]
        );
        await interaction.editReply(updated.rowCount ? "✅ Poll #" + id + " approved." :
          "No pending poll found with that ID.");
      } else {
        const extra = sub === "reject" ? " AND approved=FALSE" : "";
        const deleted = await pool.query(
          "DELETE FROM faye_poll_entries WHERE guild_id=$1 AND id=$2 AND used=FALSE " + extra +
          " AND id NOT IN (SELECT poll_id FROM faye_daily_poll_posts) RETURNING id",
          [guildId, id]
        );
        await interaction.editReply(deleted.rowCount ? "🗑️ Poll #" + id + " removed." :
          "No eligible unused poll found with that ID.");
      }
      return;
    }

    if (sub === "post") {
      const result = await postPoll(interaction.client, guildId,
        interaction.options.getInteger("id", true));
      await interaction.editReply(result.status === "posted"
        ? "✅ Poll #" + result.id + " posted to <#" + result.channelId + ">."
        : result.status === "already_posted"
        ? "A poll has already been recorded for today."
        : result.status === "not_configured"
        ? "Use /poll channel first."
        : result.status === "channel_not_found"
        ? "The configured poll channel is inaccessible."
        : "No approved unused poll was found with that ID.");
      return;
    }
  } catch (error) {
    console.error("❌ /poll " + sub + " failed", error);
    await interaction.editReply("❌ " +
      (error instanceof Error ? error.message : "The poll command failed."));
  }
}
