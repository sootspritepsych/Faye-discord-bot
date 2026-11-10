const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildReplyContext } = require("../src/lib/replyContext.ts");

function message(id, content, parent = null, overrides = {}) {
  return {
    id, content, channelId: "main", guildId: "garden",
    author: { id: "member", username: "Cami" },
    embeds: [],
    reference: parent ? { messageId: parent.id } : null,
    fetchReference: async () => parent,
    ...overrides,
  };
}

function qotd(id = "question", question = "What is your favorite animal?") {
  return message(id, "<@&qotd-role>", null, {
    author: { id: "faye", username: "Faye" },
    embeds: [{ title: "🌸 Question of the Day", description: `**${question}**`, fields: [] }],
  });
}

function entries(context) {
  return JSON.parse(context.slice(context.indexOf("\n") + 1));
}

test("reads the question inside Faye's embed for an unpinged short answer", async () => {
  const question = qotd();
  const answer = message("answer", "Cats", question);
  const context = entries(await buildReplyContext(answer, question, "faye"));
  assert.match(context[0].text, /What is your favorite animal/);
  assert.equal(context[0].source, "Faye's Question of the Day");
  assert.equal(context[0].author, "Faye");
});

test("follows a fresh, uncached reply chain back to the original QOTD", async () => {
  const question = qotd("old-question", "Which book would you live in?");
  const answer = message("first-answer", "Howl's Moving Castle", question);
  const response = message("faye-response", "A magical choice!", answer, {
    author: { id: "faye", username: "Faye" },
  });
  const followup = message("followup", "Especially for the castle!", response);
  const context = entries(await buildReplyContext(followup, response, "faye"));
  assert.deepEqual(context.map((entry) => entry.messageId), [
    "old-question", "first-answer", "faye-response",
  ]);
  assert.equal(context[1].authorId, "member");
  assert.equal(context[2].source, "Faye's reply");
  assert.match(context[0].text, /Which book would you live in/);
});

test("keeps different members' identities and reads embed fields", async () => {
  const other = message("other", "", null, {
    member: { displayName: "Other Gardener" },
    author: { id: "other-member", username: "Other" },
    embeds: [{ title: "An answer", description: "Books", fields: [{ name: "Favorite", value: "Fantasy" }] }],
  });
  const context = entries(await buildReplyContext(message("reply", "Me too", other), other, "faye"));
  assert.equal(context[0].authorId, "other-member");
  assert.equal(context[0].author, "Other Gardener");
  assert.equal(context[0].source, "Member's message");
  assert.match(context[0].text, /Fantasy/);
});

test("does not treat another member's QOTD embed as Faye's own question", async () => {
  const fake = qotd();
  fake.author.id = "another-bot";
  const context = entries(await buildReplyContext(message("reply", "Cats", fake), fake, "faye"));
  assert.equal(context[0].source, "Member's message");
});

test("continues with available context when an ancestor was deleted", async () => {
  const parent = message("parent", "A previous answer", null, {
    reference: { messageId: "deleted" },
    fetchReference: async () => { throw new Error("Unknown Message"); },
  });
  const context = entries(await buildReplyContext(message("reply", "Why?", parent), parent, "faye"));
  assert.equal(context.length, 1);
  assert.equal(context[0].text, "A previous answer");
});

test("excludes cross-channel and cross-server content", async () => {
  const incoming = message("reply", "Hello");
  for (const overrides of [{ channelId: "staff" }, { guildId: "other-server" }]) {
    assert.equal(await buildReplyContext(incoming, message("private", "Secret", null, overrides), "faye"), "");
  }
  assert.equal(await buildReplyContext(incoming, null, "faye"), "");
});

test("bounds long messages, reply depth and malformed circular references", async () => {
  let parent = null;
  for (let i = 0; i < 20; i++) parent = message(`ancestor-${i}`, "x".repeat(5000), parent);
  const incoming = message("reply", "Okay", parent);
  const context = entries(await buildReplyContext(incoming, parent, "faye"));
  assert.equal(context.length, 6);
  assert.ok(context.every((entry) => entry.text.length <= 900));
  const loop = message("loop", "Hello", null);
  loop.reference = { messageId: "loop" };
  loop.fetchReference = async () => loop;
  assert.equal(entries(await buildReplyContext(incoming, loop, "faye")).length, 1);
});

test("sends quoted question context to the AI immediately before the member's answer", async () => {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key-not-used-for-network";
  const { openai, getFayeResponse } = require("../src/lib/openai.ts");
  let payload;
  openai.chat.completions.create = async (request) => {
    payload = request;
    return { choices: [{ message: { content: "Cats are lovely!" } }] };
  };
  const question = qotd();
  const answer = message("answer", "Cats", question);
  const context = await buildReplyContext(answer, question, "faye");
  await getFayeResponse("Cats", "Cami", [
    { role: "assistant", content: "Unrelated newer question: favorite food?" },
  ], [], [], "Public conversation", context);
  const messages = payload.messages;
  assert.equal(messages.at(-2).role, "user");
  assert.equal(messages.at(-2).content, context);
  assert.equal(messages.at(-1).content, "Cami says: Cats");
  assert.match(messages[0].content, /that exact question/);
  assert.match(messages[0].content, /untrusted quoted data/);
});
