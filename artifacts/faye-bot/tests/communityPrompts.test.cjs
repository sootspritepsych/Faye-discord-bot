const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const { PgDialect } = require('drizzle-orm/pg-core');
const plan = require('../src/lib/communityPromptPlan.ts');

test('Chicago slots survive DST and exactly one guardian owns each weekly slot', () => {
  for (const date of ['2026-07-06T22:00:00Z', '2026-11-09T23:00:00Z']) {
    assert.deepEqual(plan.dueCommunityPrompts(new Date(date), 'faye').map(p => p.topic), ['mental']);
    assert.deepEqual(plan.dueCommunityPrompts(new Date(date), 'lilith'), []);
  }
  for (const date of ['2026-11-11T23:00:00Z', '2026-11-18T23:00:00Z']) {
    const now = new Date(date);
    const both = ['faye', 'lilith'].flatMap(s => plan.dueCommunityPrompts(now, s));
    assert.deepEqual(both.map(p => p.topic), ['exercise']);
  }
  const exercise = plan.COMMUNITY_PROMPTS.find(p => p.topic === 'exercise');
  assert.notEqual(plan.promptGuardian(exercise, 10), plan.promptGuardian(exercise, 11));
  for (const date of ['2026-11-09T22:59:00Z', '2026-11-10T00:00:00Z', '2026-11-10T23:00:00Z']) {
    assert.deepEqual(plan.dueCommunityPrompts(new Date(date), 'faye'), []);
  }
  assert.equal(plan.normalizedCommunityName('🍿︱robins-investment-corner'), 'robinsinvestmentcorner');
  for (const p of plan.COMMUNITY_PROMPTS) {
    const prompts = new Set();
    for (let i = 0; i < p.prompts.length; i++) prompts.add(plan.communityPromptText(p, new Date(Date.UTC(2026, 0, 5 + i * 7, 23))));
    assert.equal(prompts.size, p.prompts.length);
  }
});

test('concurrent ticks reserve once; invalid channels and missed slots never post', async t => {
  process.env.DATABASE_URL ||= 'postgres://unused:unused@localhost/unused';
  process.env.DISCORD_GUILD_ID = 'home';
  const { db } = require('../src/lib/database.ts');
  const { runCommunityPromptTick } = require('../src/lib/communityPrompts.ts');
  const dialect = new PgDialect();
  const claimed = new Set(), sent = [];
  t.mock.method(db, 'execute', async query => {
    const q = dialect.sqlToQuery(query);
    if (q.sql.includes('INSERT INTO')) {
      const key = q.params.slice(0, 3).join(':');
      if (claimed.has(key)) return { rows: [] };
      claimed.add(key); return { rows: [{}] };
    }
    return { rows: [] };
  });
  const channel = { id: 'mental', guildId: 'home', name: '🌙︱mental-health', type: ChannelType.GuildText,
    nsfw: false, permissionsFor: () => ({ has: () => true }),
    send: async options => { sent.push(options); return { id: 'posted' }; } };
  const channels = new Collection([[channel.id, channel]]);
  const guild = { members: { me: {} }, channels: { fetch: async () => channels } };
  const client = { guilds: { fetch: async () => guild } };
  const now = new Date('2026-11-09T23:00:00Z');
  await Promise.all([runCommunityPromptTick(client, now), runCommunityPromptTick(client, now)]);
  await runCommunityPromptTick(client, now);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].allowedMentions, { parse: [] });
  assert.equal(sent[0].enforceNonce, true);
  assert.match(sent[0].content, /Reply to this message/);
  const next = new Date('2026-11-16T23:00:00Z');
  t.mock.method(console, 'error', () => {});
  channel.guildId = 'foreign';
  await runCommunityPromptTick(client, next);
  channel.guildId = 'home'; channel.nsfw = true;
  await runCommunityPromptTick(client, next);
  channel.nsfw = false;
  channels.set('duplicate', { ...channel, id: 'duplicate' });
  await runCommunityPromptTick(client, next);
  channels.delete('duplicate');
  await runCommunityPromptTick(client, new Date('2026-11-17T00:00:00Z'));
  assert.equal(sent.length, 1);
  channel.send = async () => { throw new Error('ambiguous failure'); };
  await runCommunityPromptTick(client, next);
  channel.send = async options => { sent.push(options); return { id: 'retry' }; };
  await runCommunityPromptTick(client, next);
  assert.equal(sent.length, 1, 'ambiguous send failures are not retried');
});

test('only Lilith receives the needed permissions in the two approved channels', async () => {
  process.env.DISCORD_GUILD_ID = 'home';
  process.env.LILITH_BOT_ID = 'sister';
  const { ensureLilithCommunityAccess } = require('../src/lib/communityPrompts.ts');
  const edits = [];
  const sister = { id: 'sister' };
  const guild = { members: { me: { id: 'faye' }, fetch: async id => {
    assert.equal(id, 'sister'); return sister;
  } } };
  const channels = new Collection();
  for (const name of ['mental-health', 'exercise-and-diet', 'robios-investment-corner', 'growth-and-development']) {
    const channel = { id: name, name, guildId: 'home', guild, type: ChannelType.GuildText, nsfw: false,
      permissionsFor: member => ({ has: () => member !== sister }),
      permissionOverwrites: { edit: async (id, permissions) => { edits.push({ name, id, permissions }); } } };
    channels.set(name, channel);
  }
  guild.channels = { fetch: async () => channels };
  await ensureLilithCommunityAccess({ guilds: { fetch: async () => guild } });
  assert.deepEqual(edits.map(edit => edit.name), ['exercise-and-diet', 'robios-investment-corner']);
  for (const edit of edits) {
    assert.equal(edit.id, 'sister');
    assert.deepEqual(edit.permissions, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  }
});
