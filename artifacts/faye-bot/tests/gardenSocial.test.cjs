const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
function stub(path, exports) {
  const file = require.resolve(path);
  const m = new Module(file); m.loaded = true; m.exports = exports; require.cache[file] = m;
}
let query = async () => ({ rows: [], rowCount: 0 });
let allowed = true;
const saved = [], ai = [];
stub('../src/lib/database.ts', { pool: { query: (...args) => query(...args) } });
stub('../src/lib/gardenSocialStore.ts', {
  initSocialStore: async () => {}, claimSocialUse: async () => allowed,
  saveSocialEvent: async (...args) => saved.push(args),
});
stub('../src/lib/gardenSocialText.ts', { socialText: async (...args) => { ai.push(args); return args[3]; } });
const { socialCommands, handleSocialInteraction } = require('../src/commands/gardenSocial.ts');
const { complimentCommand } = require('../src/commands/compliment.ts');
function interaction(name, options = {}) {
  const out = [];
  return {
    id: '123456789012345678', guildId: '223456789012345678', channelId: '323456789012345678',
    user: { id: '423456789012345678', username: 'Cami' }, commandName: name,
    guild: { members: { fetch: async () => ({ displayName: 'Friend' }) } },
    options: { getString: k => options[k] ?? null, getUser: k => options[k] ?? null },
    reply: async r => out.push(r), deferReply: async r => out.push(r), editReply: async r => out.push(r), out,
  };
}
async function run(name, options) {
  const i = interaction(name, options);
  await socialCommands.find(c => c.data.name === name).execute(i); return i;
}
test('nine Faye command schemas serialize with valid descriptions and no DM access', () => {
  const commands = [...socialCommands, complimentCommand].map(c => c.data.toJSON());
  assert.equal(new Set(commands.map(c => c.name)).size, 9);
  for (const c of commands) { assert.equal(c.dm_permission, false); assert(c.description.length <= 100); }
  assert(commands.find(c => c.name === 'ask-sisters').options[0].required);
  assert(commands.find(c => c.name === 'wish').options[0].required);
});
test('duality labels both sisters and limits mentions', async () => {
  const i = await run('duality'); const response = i.out.at(-1);
  assert.deepEqual(response.embeds[0].data.fields.map(f => f.name), ['🌸 Faye', '🌙 Lilith']);
  assert.deepEqual(response.allowedMentions.parse, []);
});
test('gifts save recipient and item while neutralizing note mentions', async () => {
  const i = await run('gift', { user: { id: '523456789012345678' }, item: 'tea', note: 'hello @everyone' });
  assert.equal(saved.at(-1)[4], 'gift'); assert.equal(saved.at(-1)[6], '523456789012345678');
  assert.equal(saved.at(-1)[5].item, 'tea');
  assert.match(i.out.at(-1).embeds[0].data.description, /＠everyone/);
});
test('collection is private and scoped to recipient and guild', async () => {
  const calls = []; query = async (...args) => { calls.push(args); return { rows: [{ item: 'flower', count: 2 }] }; };
  const i = await run('gift', {}); assert.equal(i.out[0].ephemeral, true);
  assert.deepEqual(calls[0][1], [i.guildId, i.user.id]);
  assert.match(i.out.at(-1).embeds[0].data.description, /\*\*2\*\*/);
});
test('cooldowns stop output and do not create another gift', async () => {
  allowed = false; const before = saved.length;
  try {
    const i = await run('gift', { user: { id: '523456789012345678' } });
    assert.match(i.out.at(-1), /30 seconds/); assert.equal(saved.length, before);
  } finally { allowed = true; }
});
test('another member cannot open a tea reply modal', async () => {
  const i = interaction(''); Object.assign(i, {
    customId: 'social:tea:123:999', isButton: () => true, isModalSubmit: () => false,
    showModal: async () => assert.fail('not the tea owner'),
  });
  await handleSocialInteraction(i); assert.match(i.out.at(-1).content, /belongs to someone else/);
});
test('expired tea is rejected and lookup checks guild, channel, and owner', async () => {
  const calls = []; query = async (...args) => { calls.push(args); return { rows: [] }; };
  const i = interaction(''); Object.assign(i, {
    customId: `social:tea-reply:123:${i.user.id}`, isButton: () => false, isModalSubmit: () => true,
  });
  await handleSocialInteraction(i); assert.match(i.out.at(-1), /cooled/);
  assert.deepEqual(calls[0][1], ['123', i.guildId, i.channelId, i.user.id]);
});
test('compliments use the chosen member and supplied celebration', async () => {
  const i = interaction('compliment', { user: { id: '523456789012345678' }, about: 'helping newcomers' });
  await complimentCommand.execute(i);
  assert.match(ai.at(-1)[2], /helping newcomers/);
  assert.match(i.out.at(-1).embeds[0].data.description, /523456789012345678/);
});
