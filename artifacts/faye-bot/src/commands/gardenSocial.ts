import { createHash, randomInt } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { Command } from "./index";
import { pool } from "../lib/database";
import {
  claimSocialUse,
  initSocialStore,
  saveSocialEvent,
} from "../lib/gardenSocialStore";
import { socialText, type Sister } from "../lib/gardenSocialText";

const noMentions = { parse: [] as never[] };
const gifts = {
  flower: "🌸 A little bouquet",
  tea: "🍵 A warm cup of tea",
  leaf: "🍀 A lucky leaf",
  lantern: "🏮 A tiny lantern",
  mushroom: "🍄 A pocket mushroom",
};
const auras = [
  "🌙 Moonflower — quietly magical, especially after dark",
  "🍄 Chaotic mushroom — tiny plans, enormous side quests",
  "🌳 Sleepy willow — a soft place to land",
  "🌻 Sunflower — your enthusiasm has its own weather",
  "🪻 Lavender — calm with excellent boundaries",
  "✨ Firefly — small moments, unexpected brightness",
  "🌵 Cozy cactus — affectionate, with boundaries",
  "🌿 Wandering fern — curious about every hidden path",
];
const places = {
  grove: [
    "the Lantern Grove",
    "A lantern flickers as you pass. Faye wonders whether it is saying hello.",
    "🏮 Lantern charm",
  ],
  pond: [
    "the Moonlit Pond",
    "A ripple moves against the breeze. Whatever caused it has already slipped away.",
    "🪷 Pond petal",
  ],
  path: [
    "the Mossy Path",
    "Someone has tucked a tiny ribbon around a root. Neither sister offers an explanation.",
    "🎀 Moss ribbon",
  ],
  tree: [
    "the Old Tree",
    "A leaf turns in perfectly still air. Lilith suggests listening before asking questions.",
    "🍂 Whisper leaf",
  ],
  meadow: [
    "the Wildflower Meadow",
    "Sprout disappears into the flowers and returns looking suspiciously pleased.",
    "🌼 Meadow bloom",
  ],
};
function clean(value: string): string {
  return escapeMarkdown(value.replace(/@/g, "＠"));
}
function stableIndex(key: string, length: number): number {
  return createHash("sha256").update(key).digest().readUInt32BE(0) % length;
}
function sisterOption(builder: SlashCommandBuilder): void {
  builder.addStringOption((o) =>
    o
      .setName("sister")
      .setDescription("Who joins you?")
      .addChoices(
        { name: "Faye 🌸", value: "Faye" },
        { name: "Lilith 🌙", value: "Lilith" },
      ),
  );
}
function userOption(builder: SlashCommandBuilder): void {
  builder.addUserOption((o) =>
    o
      .setName("user")
      .setDescription("Choose a member, or leave blank for yourself"),
  );
}
function make(
  name: string,
  description: string,
  configure?: (b: SlashCommandBuilder) => void,
): Command {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDMPermission(false);
  configure?.(data);
  return { data, execute: executeSocial };
}
export const socialCommands: Command[] = [
  make(
    "duality",
    "Faye compliments you; Lilith has some commentary",
    userOption,
  ),
  make("gift", "Give a garden keepsake, or view your received gifts", (b) => {
    b.addUserOption((o) =>
      o
        .setName("user")
        .setDescription(
          "Who receives your gift? Leave blank to see your collection",
        ),
    );
    b.addStringOption((o) =>
      o
        .setName("item")
        .setDescription("Choose a little keepsake")
        .addChoices(
          ...Object.entries(gifts).map(([value, name]) => ({ name, value })),
        ),
    );
    b.addStringOption((o) =>
      o
        .setName("note")
        .setDescription("A message to include")
        .setMaxLength(200),
    );
  }),
  make(
    "fortune",
    "A daily whimsical fortune from one of the sisters",
    sisterOption,
  ),
  make(
    "ask-sisters",
    "Ask one question and hear both sisters' perspectives",
    (b) => {
      b.addStringOption((o) =>
        o
          .setName("question")
          .setDescription("What would you like to ask?")
          .setRequired(true)
          .setMaxLength(500),
      );
    },
  ),
  make("vibe", "Discover a member's garden aura for today", userOption),
  make(
    "explore",
    "Find hidden encounters and collect garden keepsakes",
    (b) => {
      b.addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Explore or look in your keepsake bag")
          .addChoices(
            { name: "Explore (3 journeys per UTC day)", value: "explore" },
            { name: "My keepsake bag", value: "bag" },
          ),
      );
      b.addStringOption((o) =>
        o
          .setName("location")
          .setDescription("Choose a path, or let the Garden decide")
          .addChoices(
            ...Object.entries(places).map(([value, p]) => ({
              name: p[0],
              value,
            })),
          ),
      );
    },
  ),
  make("tea", "Sit with a sister for a short, interactive tea chat", (b) => {
    b.addStringOption((o) =>
      o
        .setName("topic")
        .setDescription("Something on your mind, or leave blank for a prompt")
        .setMaxLength(500),
    );
    sisterOption(b);
  }),
  make("wish", "Leave a wish on the tree for others to encourage", (b) => {
    b.addStringOption((o) =>
      o
        .setName("text")
        .setDescription("Your wish will be visible in this channel")
        .setRequired(true)
        .setMaxLength(300),
    );
  }),
];

async function executeSocial(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.guildId || !i.guild) {
    await i.reply({
      content: "These little adventures happen in a server garden.",
      ephemeral: true,
    });
    return;
  }
  const cmd = i.commandName;
  const collection =
    (cmd === "gift" && !i.options.getUser("user")) ||
    (cmd === "explore" && i.options.getString("action") === "bag");
  await i.deferReply({ ephemeral: collection });
  await initSocialStore();
  if (!(await claimSocialUse(i.guildId, i.user.id, `command:${cmd}`, 1, 30))) {
    await i.editReply(
      "Give the Garden a moment. You can use this command again in up to 30 seconds. 🍃",
    );
    return;
  }
  const target = i.options.getUser("user") ?? i.user;
  if (["gift", "vibe", "duality"].includes(cmd)) {
    const member = await i.guild.members.fetch(target.id).catch(() => null);
    if (!member || target.bot) {
      await i.editReply("Choose a human member of this server. 🌿");
      return;
    }
  }
  const embed = new EmbedBuilder().setColor(0x9b7ede);
  const sister = (i.options.getString("sister") ??
    (randomInt(2) ? "Faye" : "Lilith")) as Sister;
  const day = new Date().toISOString().slice(0, 10);
  let components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (cmd === "duality" || cmd === "ask-sisters") {
    const question =
      cmd === "ask-sisters" ? i.options.getString("question", true) : "";
    const input =
      question ||
      `A lighthearted compliment and roast game for the member displayed as ${target.globalName ?? target.username}. Do not infer personality or vulnerabilities from the name.`;
    const [faye, lilith] = await Promise.all([
      socialText(
        "Faye",
        question
          ? "Answer the user's question warmly and specifically."
          : "Give a short, sweet compliment.",
        input,
        "You bring something to this Garden that no one else can. There is room for you here. 🌸",
      ),
      socialText(
        "Lilith",
        question
          ? "Answer the user's question with dry humor and a useful perspective."
          : "Give a gentle, funny roast about fictional garden mishaps; no personal accusations.",
        input,
        "You have the energy of someone who starts a side quest halfway through another side quest. I respect the commitment. 🌙",
      ),
    ]);
    embed
      .setTitle(
        question ? "🌸🌙 Ask the Sisters" : "🌸🌙 Two Sisters, Two Opinions",
      )
      .setDescription(
        question ? clean(question) : `The sisters turn toward <@${target.id}>…`,
      )
      .addFields(
        { name: "🌸 Faye", value: faye },
        { name: "🌙 Lilith", value: lilith },
      );
  } else if (cmd === "gift") {
    if (collection) {
      const rows = await pool.query(
        `SELECT payload->>'item' AS item,COUNT(*)::int AS count FROM garden_social_events WHERE guild_id=$1 AND recipient_id=$2 AND kind='gift' GROUP BY payload->>'item' ORDER BY count DESC`,
        [i.guildId, i.user.id],
      );
      embed
        .setTitle("🎁 Your Garden Gifts")
        .setDescription(
          rows.rows
            .map(
              (r) =>
                `${gifts[r.item as keyof typeof gifts] ?? "🎁 Keepsake"} × **${r.count}**`,
            )
            .join("\n") || "Your basket is waiting for its first little gift.",
        );
    } else {
      if (target.id === i.user.id) {
        await i.editReply(
          "Choose someone else to send a little kindness to. 🎁",
        );
        return;
      }
      const item = (i.options.getString("item") ??
        "flower") as keyof typeof gifts;
      const note = i.options.getString("note");
      await saveSocialEvent(
        i.id,
        i.guildId,
        i.channelId,
        i.user.id,
        "gift",
        { item, note },
        target.id,
      );
      embed
        .setTitle("🎁 A Little Garden Kindness")
        .setDescription(
          `<@${i.user.id}> gives <@${target.id}> **${gifts[item]}**${note ? `\n\n${clean(note)}` : ""}`,
        )
        .setFooter({
          text: "A decorative keepsake • /gift to see your received collection",
        });
    }
  } else if (cmd === "fortune") {
    const id = `fortune:${i.guildId}:${i.user.id}:${day}:${sister}`;
    const saved = await pool.query(
      "SELECT payload FROM garden_social_events WHERE id=$1",
      [id],
    );
    const fortunes = [
      "A small kindness will find its way back to you. Leave room for a pleasant surprise.",
      "An unexpected path may be worth exploring. Pack snacks and a little curiosity.",
      "Something unfinished can wait while you enjoy one ordinary, lovely moment.",
      "The lanterns favor a tiny brave step. It need not be a dramatic one.",
    ];
    let fortune = saved.rows[0]?.payload.text as string | undefined;
    if (!fortune) {
      fortune = await socialText(
        sister,
        "Offer one whimsical garden fortune, gently hopeful or dryly funny.",
        "Today's fortune, with no personal claims.",
        fortunes[stableIndex(id, fortunes.length)]!,
      );
      await pool.query(
        `INSERT INTO garden_social_events (id,guild_id,channel_id,user_id,kind,payload) VALUES ($1,$2,$3,$4,'fortune',$5) ON CONFLICT DO NOTHING`,
        [
          id,
          i.guildId,
          i.channelId,
          i.user.id,
          JSON.stringify({ text: fortune }),
        ],
      );
      const canonical = await pool.query(
        "SELECT payload FROM garden_social_events WHERE id=$1",
        [id],
      );
      fortune = canonical.rows[0].payload.text;
    }
    embed
      .setTitle(`🔮 ${sister}'s Daily Fortune`)
      .setDescription(fortune!)
      .setFooter({
        text: "A little make-believe • New fortunes at midnight UTC",
      });
  } else if (cmd === "vibe") {
    embed
      .setTitle("✨ Today's Garden Aura")
      .setDescription(
        `<@${target.id}>\n\n**${auras[stableIndex(`${i.guildId}:${target.id}:${day}`, auras.length)]}**`,
      )
      .setFooter({ text: "Just for fun • A new aura at midnight UTC" });
  } else if (cmd === "explore") {
    if (collection) {
      const rows = await pool.query(
        `SELECT payload->>'keepsake' AS item, COUNT(*)::int AS count FROM garden_social_events WHERE guild_id=$1 AND user_id=$2 AND kind='explore' GROUP BY payload->>'keepsake' ORDER BY count DESC`,
        [i.guildId, i.user.id],
      );
      embed
        .setTitle("🎒 Your Keepsake Bag")
        .setDescription(
          rows.rows.map((r) => `${r.item} × **${r.count}**`).join("\n") ||
            "Take a walk with /explore to discover your first keepsake.",
        );
    } else {
      if (!(await claimSocialUse(i.guildId, i.user.id, "explore", 3))) {
        await i.editReply(
          "Your three journeys are complete for today. Return after midnight UTC, or use `/explore action:My keepsake bag`. 🌙",
        );
        return;
      }
      const key =
        i.options.getString("location") ??
        Object.keys(places)[randomInt(Object.keys(places).length)]!;
      const [place, story, keepsake] = places[key as keyof typeof places];
      await saveSocialEvent(
        i.id,
        i.guildId,
        i.channelId,
        i.user.id,
        "explore",
        { place, keepsake },
      );
      embed
        .setTitle(`🍃 Exploring ${place}`)
        .setDescription(
          `<@${i.user.id}> follows the path…\n\n${story}\n\n**Found: ${keepsake}**`,
        )
        .setFooter({
          text: "Saved in your keepsake bag • 3 journeys per UTC day",
        });
    }
  } else if (cmd === "wish") {
    if (!(await claimSocialUse(i.guildId, i.user.id, "wish"))) {
      await i.editReply(
        "You have already left a wish today. The tree has room for another after midnight UTC. ✨",
      );
      return;
    }
    const wish = i.options.getString("text", true);
    await saveSocialEvent(i.id, i.guildId, i.channelId, i.user.id, "wish", {
      text: wish,
    });
    embed
      .setTitle("✨ A Wish for the Community Tree")
      .setDescription(
        `<@${i.user.id}> ties a wish to a branch:\n\n${clean(wish)}`,
      )
      .setFooter({ text: "Send a little encouragement with the button below" });
    components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`social:wish:${i.id}`)
          .setLabel("Send encouragement 🌸")
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  } else if (cmd === "tea") {
    const topic =
      i.options.getString("topic") ??
      "Choose a cozy conversation starter and invite me to answer it.";
    const answer = await socialText(
      sister,
      "Begin a short tea chat. Respond to the topic and finish with one inviting question.",
      topic,
      sister === "Faye"
        ? "I've saved you the comfortable chair. What is one small thing you would like more of this week? 🍵"
        : "I made tea. This proves nothing. What minor inconvenience would you like to dramatically complain about today? 🍵",
    );
    await pool.query(
      `INSERT INTO garden_tea_sessions (id,guild_id,channel_id,user_id,sister,messages,expires_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '10 minutes')`,
      [
        i.id,
        i.guildId,
        i.channelId,
        i.user.id,
        sister,
        JSON.stringify([
          { role: "user", text: topic },
          { role: "assistant", text: answer },
        ]),
      ],
    );
    embed
      .setTitle(`🍵 Tea with ${sister}`)
      .setDescription(answer)
      .setFooter({
        text: "Your tea chat lasts 10 minutes • Reply using the button",
      });
    components = [teaButtons(i.id, i.user.id)];
  }
  await i.editReply({
    embeds: [embed],
    components,
    allowedMentions: noMentions,
  });
}

function teaButtons(
  id: string,
  owner: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`social:tea:${id}:${owner}`)
      .setLabel("Reply over tea 🍵")
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function handleSocialInteraction(
  i: Interaction,
): Promise<boolean> {
  if (!(i.isButton() || i.isModalSubmit()) || !i.customId.startsWith("social:"))
    return false;
  if (!i.guildId) {
    await i.reply({
      content: "Visit the server garden for this interaction.",
      ephemeral: true,
    });
    return true;
  }
  const [, kind, id, owner] = i.customId.split(":");
  if (kind === "tea") {
    if (owner !== i.user.id) {
      await i.reply({
        content:
          "This cup belongs to someone else. Start your own chat with /tea. 🍵",
        ephemeral: true,
      });
      return true;
    }
    if (i.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId(`social:tea-reply:${id}:${owner}`)
        .setTitle("Continue your tea chat");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("reply")
            .setLabel("What would you like to say?")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true),
        ),
      );
      await i.showModal(modal);
      return true;
    }
  }
  await i.deferReply({ ephemeral: kind === "wish" });
  await initSocialStore();
  if (kind === "wish") {
    const wish = await pool.query(
      `SELECT user_id FROM garden_social_events WHERE id=$1 AND guild_id=$2 AND channel_id=$3 AND kind='wish'`,
      [id, i.guildId, i.channelId],
    );
    if (!wish.rowCount) {
      await i.editReply("That wish could not be found here.");
      return true;
    }
    if (wish.rows[0].user_id === i.user.id) {
      await i.editReply(
        "Your wish is already on the tree. Let someone else send you a little encouragement. 🌸",
      );
      return true;
    }
    const result = await pool.query(
      `INSERT INTO garden_wish_support (wish_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING user_id`,
      [id, i.user.id],
    );
    const total = await pool.query(
      "SELECT COUNT(*)::int AS total FROM garden_wish_support WHERE wish_id=$1",
      [id],
    );
    await i.editReply(
      `${result.rowCount ? "🌸 You sent a little encouragement." : "🌸 Your encouragement is already saved."} This wish has support from **${total.rows[0].total}** gardener(s).`,
    );
    return true;
  }
  if (kind === "tea-reply" && i.isModalSubmit()) {
    if (owner !== i.user.id) {
      await i.editReply("Start your own tea chat with /tea. 🍵");
      return true;
    }
    const result = await pool.query(
      "SELECT * FROM garden_tea_sessions WHERE id=$1 AND guild_id=$2 AND channel_id=$3 AND user_id=$4 AND expires_at>NOW()",
      [id, i.guildId, i.channelId, i.user.id],
    );
    const session = result.rows[0];
    if (!session) {
      await i.editReply("The tea has cooled. Start a fresh chat with /tea. 🍵");
      return true;
    }
    if (!(await claimSocialUse(i.guildId, i.user.id, "tea-reply", 1, 15))) {
      await i.editReply(
        "Let the tea steep for up to 15 seconds before replying again. 🍵",
      );
      return true;
    }
    const reply = i.fields.getTextInputValue("reply");
    const messages = [...session.messages, { role: "user", text: reply }].slice(
      -7,
    );
    const answer = await socialText(
      session.sister,
      "Continue this tea conversation. Respond to the latest message using the provided tea-chat context. Ask at most one follow-up question.",
      JSON.stringify(messages),
      session.sister === "Faye"
        ? "I'm here with you. What part of that has been on your mind the most? 🍵"
        : "Consider this your invitation to elaborate. I've poured another cup. 🍵",
    );
    await pool.query("UPDATE garden_tea_sessions SET messages=$2 WHERE id=$1", [
      id,
      JSON.stringify([...messages, { role: "assistant", text: answer }]),
    ]);
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b7ede)
          .setTitle(`🍵 Tea with ${session.sister}`)
          .setDescription(answer),
      ],
      components: [teaButtons(id!, owner!)],
      allowedMentions: noMentions,
    });
    return true;
  }
  await i.editReply("This garden interaction is no longer available.");
  return true;
}
