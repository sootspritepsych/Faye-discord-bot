const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const { imagePostTime, postDailyImage } = require('../src/lib/dailyImageJob.ts');

function fixture(overrides = {}) {
  const claimed = new Set();
  const messages = [];
  const pool = { query: async (sql, values) => {
    const key = values?.slice(0, 3).join(':');
    if (sql.startsWith('SELECT 1')) return { rows: claimed.has(key) ? [{}] : [] };
    if (sql.startsWith('SELECT image_key')) return { rows: [] };
    if (sql.startsWith('INSERT')) {
      if (claimed.has(key)) return { rows: [] };
      claimed.add(key); return { rows: [{}] };
    }
    return { rows: [] };
  } };
  const channel = { id: 'food', name: '🍜・foodie', type: ChannelType.GuildText,
    permissionsFor: () => ({ has: () => true }),
    send: async payload => { messages.push(payload); return { id: 'message' }; },
  };
  const channels = new Collection([[channel.id, channel]]);
  const client = { guilds: { fetch: async () => ({
    channels: { fetch: async () => channels }, members: { me: {} },
  }) } };
  const options = { key: 'food', guildId: 'garden', channelNames: ['foodie'], hour: 12,
    content: 'Would you eat this? Yes or no?', pool,
    pick: async () => ({ id: 'meal', title: 'A meal', image: 'https://example.com/food.jpg',
      source: 'https://example.com/meal', credit: 'Photo source' }), ...overrides,
  };
  return { client, options, channel, channels, messages, claimed };
}

test('daily date follows Chicago, including daylight saving time', () => {
  assert.deepEqual(imagePostTime(new Date('2026-11-11T05:59:00Z')), { day: '2026-11-10', minute: 1439 });
  assert.deepEqual(imagePostTime(new Date('2026-07-01T17:00:00Z')), { day: '2026-07-01', minute: 720 });
});

test('concurrent runs and a subsequent restart send only one image, with no poll or pings', async () => {
  const f = fixture();
  const date = new Date('2026-11-10T18:00:00Z');
  const results = await Promise.all([postDailyImage(f.client, f.options, date), postDailyImage(f.client, f.options, date)]);
  assert.equal(results.filter(r => r === 'posted').length, 1);
  assert.equal(await postDailyImage(f.client, f.options, date), 'already_posted');
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].content, 'Would you eat this? Yes or no?');
  assert.equal('poll' in f.messages[0], false);
  assert.deepEqual(f.messages[0].allowedMentions, { parse: [] });
  assert.equal(f.messages[0].embeds[0].toJSON().image.url, 'https://example.com/food.jpg');
});

test('provider failure leaves the day available for retry', async () => {
  const f = fixture({ pick: async () => { throw new Error('provider down'); } });
  await assert.rejects(postDailyImage(f.client, f.options), /provider down/);
  assert.equal(f.claimed.size, 0);
  assert.equal(f.messages.length, 0);
});

test('uncertain Discord send keeps the claim to prevent a duplicate', async () => {
  const f = fixture();
  f.channel.send = async () => { throw new Error('send timed out'); };
  assert.equal(await postDailyImage(f.client, f.options), 'send_uncertain');
  assert.equal(await postDailyImage(f.client, f.options), 'already_posted');
});

test('ambiguous channels fail without sending or claiming', async () => {
  const f = fixture();
  f.channels.set('other', { ...f.channel, id: 'other' });
  await assert.rejects(postDailyImage(f.client, f.options), /found 2/);
  assert.equal(f.claimed.size, 0);
  assert.equal(f.messages.length, 0);
});

test('food selector rejects a repeated image and keeps its photo credit', async () => {
  process.env.DATABASE_URL ||= 'postgres://localhost/test';
  const { pickFood } = require('../src/lib/foodScheduler.ts');
  const originalFetch = global.fetch;
  let count = 0;
  global.fetch = async () => ({ ok: true, json: async () => ({ meals: [{
    idMeal: ++count === 1 ? '1' : '2', strMeal: 'Soup',
    strMealThumb: 'https://www.themealdb.com/images/media/meals/soup.jpg',
  }] }) });
  try {
    const food = await pickFood(new Set(['1']));
    assert.equal(food.id, '2');
    assert.match(food.credit, /TheMealDB/);
  } finally { global.fetch = originalFetch; }
});
