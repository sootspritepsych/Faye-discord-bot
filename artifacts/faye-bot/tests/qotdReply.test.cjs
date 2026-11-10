const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

test("the Discord handler supplies and saves QOTD context without a reply ping", async () => {
  const requests = [];
  const saved = [];
  function stub(path, exports) {
    const filename = require.resolve(path);
    const module = new Module(filename);
    module.loaded = true;
    module.exports = exports;
    require.cache[filename] = module;
  }
  stub("../src/lib/openai.ts", {
    __esModule: true,
    default: async (...args) => { requests.push(args); return "Cats are lovely!"; },
  });
  stub("../src/lib/database.ts", {
    db: { select: () => ({ from: () => ({ where: async () => [] }) }) },
    stickyMessages: { channelId: "channel_id" },
  });
  stub("../src/lib/gardenService.ts", { trackGardenMessage: async () => {}, recordGardenSpirit: async () => {} });
  stub("../src/lib/stickyManager.ts", { updateStickyMessage: async () => {} });
  stub("../src/lib/memory.ts", {
    getRecentConversation: async () => [],
    saveConversationMessage: async (...args) => { saved.push(args); },
  });
  stub("../src/lib/userMemory.ts", { getUserMemories: async () => [], saveUserMemory: async () => {} });
  stub("../src/lib/fayeRapportService.ts", {
    recordFayeInteraction: async () => ({}),
    formatFayeRapportContext: () => "Public conversation",
  });
  const register = require("../src/events/messageCreate.ts").default;
  let listener;
  const client = { user: { id: "faye" }, on: (_event, callback) => { listener = callback; } };
  register(client);
  const question = {
    id: "yesterdays-question", channelId: "main", guildId: "garden",
    author: { id: "faye", username: "Faye", bot: true },
    content: "<@&qotd-role>",
    embeds: [{ title: "🌸 Question of the Day", description: "**What is your favorite animal?**", fields: [] }],
  };
  const replies = [];
  const answer = {
    id: "answer", channelId: "main", guildId: "garden",
    guild: { id: "garden", roles: { everyone: {} } },
    channel: { id: "main", type: 0 },
    author: { id: "cami", username: "Cami", bot: false },
    content: "Cats", attachments: new Map(), embeds: [],
    mentions: { users: new Map(), roles: new Map(), everyone: false },
    reference: { messageId: question.id },
    fetchReference: async () => question,
    inGuild: () => true,
    reply: async (reply) => { replies.push(reply); },
    react: async () => { throw new Error("Unexpected cooldown reaction"); },
  };
  await listener(answer);
  assert.equal(replies.length, 1);
  assert.equal(requests[0][0], "Cats");
  assert.match(requests[0][6], /What is your favorite animal/);
  assert.match(requests[0][6], /Faye's Question of the Day/);
  const storedAnswer = saved.find((entry) => entry[3] === "user");
  assert.equal(storedAnswer[0], "faye:guild:garden:channel:main");
  assert.match(storedAnswer[4], /What is your favorite animal/);
  assert.match(storedAnswer[4], /Cami's answer: Cats/);

  // Another member can continue via Faye's reply; the question is still fetched.
  const fayeResponse = {
    ...question, id: "faye-response", content: "Cats are lovely!", embeds: [],
    reference: { messageId: answer.id }, fetchReference: async () => answer,
  };
  await listener({
    ...answer, id: "followup", content: "Dogs for me!",
    author: { id: "other-member", username: "Other", bot: false },
    reference: { messageId: fayeResponse.id }, fetchReference: async () => fayeResponse,
  });
  assert.equal(requests.length, 2);
  assert.match(requests[1][6], /What is your favorite animal/);
  assert.match(requests[1][6], /Cats are lovely/);
  assert.match(requests[1][6], /"authorId":"cami"/);
});
