const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PgDialect } = require('drizzle-orm/pg-core');
const { ChannelType } = require('discord.js');
const { confessionWeek, randomConfessionTime, chooseConfession, WEEK_MS } = require('../src/lib/guardianConfessionPlan.ts');

test('weekly plans stay inside UTC weeks, including Sunday and DST boundaries', () => {
  for (const date of ['2026-11-01T07:00:00Z', '2026-12-31T23:59:00Z', '2026-11-08T23:59:59.999Z']) {
    const now = new Date(date);
    const week = confessionWeek(now);
    assert.equal(week.getUTCDay(), 1);
    assert.equal(week.getUTCHours(), 0);
    for (let i = 0; i < 100; i++) {
      const scheduled = randomConfessionTime(week, now);
      assert.ok(scheduled >= now);
      assert.ok(scheduled < week.getTime() + WEEK_MS);
    }
  }
  assert.equal(chooseConfession(['a', 'b', 'c'], ['a', 'b']), 'c');
  assert.notEqual(chooseConfession(['a', 'b'], ['a', 'b']), 'a');
});

test('persisted plans survive concurrent ticks; only one due post and no downtime backlog', async () => {
  const oldGuild = process.env.DISCORD_GUILD_ID;
  process.env.DISCORD_GUILD_ID = 'home';
  const rows = [];
  const sent = [];
  let initialized = false;
  const dialect = new PgDialect();
  const databasePath = require.resolve('../src/lib/database.ts');
  const previousModule = require.cache[databasePath];
  require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { db: {
    execute: async sql => {
      const query = dialect.sqlToQuery(sql);
      const p = query.params;
      if (query.sql.includes('CREATE TABLE')) {
        for (const field of ['guild_id', 'content', 'status', 'message_id']) {
          assert.match(query.sql, new RegExp(field + ' TEXT'));
        }
        initialized = true;
        return { rows: [] };
      }
      if (query.sql.includes('SELECT confessions_channel_id')) return { rows: [{ confessions_channel_id: 'confessions' }] };
      if (query.sql.includes('SELECT week_start')) return { rows: rows.filter(r => r.guild === p[0] && +r.week === +p[1]) };
      if (query.sql.includes('SELECT content')) return { rows: [...rows].reverse().slice(0, p[1]) };
      if (query.sql.includes('INSERT INTO')) {
        if (rows.some(r => r.guild === p[0] && +r.week === +p[1])) return { rows: [] };
        rows.push({ guild: p[0], week: p[1], due: p[2], content: p[3], status: 'pending' });
        return { rows: [{ scheduled_at: p[2] }] };
      }
      if (query.sql.includes("SET status = 'sending'")) {
        const found = rows.filter(r => r.guild === p[0] && +r.week === +p[1] && r.due <= new Date() && r.status === 'pending');
        found.forEach(r => { r.status = 'sending'; });
        return { rows: found.map(r => ({ content: r.content, week_start: r.week })) };
      }
      if (query.sql.includes("SET status = 'posted'")) {
        rows.find(r => r.guild === p[1] && +r.week === +p[2]).status = 'posted';
        return { rows: [] };
      }
      throw new Error(query.sql);
    }
  } } };
  const channel = { id: 'confessions', guildId: 'home', type: ChannelType.GuildText,
    permissionsFor: () => ({ has: () => true }),
    send: async payload => { sent.push(payload); return { id: 'message' }; } };
  const client = { guilds: { fetch: async () => ({ members: { me: {} } }) }, channels: { fetch: async () => channel } };
  try {
    const { runGuardianConfessionTick, startGuardianConfessions } = require('../src/lib/guardianConfessionScheduler.ts');
    startGuardianConfessions(client);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(initialized);
    await Promise.all([runGuardianConfessionTick(client), runGuardianConfessionTick(client)]);
    assert.equal(rows.length, 2);
    assert.equal(sent.length, 0);
    const savedDates = rows.map(r => +r.due);
    await runGuardianConfessionTick(client);
    assert.deepEqual(rows.map(r => +r.due), savedDates);
    rows[0].due = new Date(0);
    rows.push({ guild: 'home', week: new Date(+rows[0].week - WEEK_MS), due: new Date(0), content: 'old', status: 'pending' });
    await Promise.all([runGuardianConfessionTick(client), runGuardianConfessionTick(client)]);
    await runGuardianConfessionTick(client);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });
    assert.match(sent[0].embeds[0].data.footer.text, /Faye/);
    assert.equal(rows[2].status, 'pending');
    channel.guildId = 'wrong-server';
    await assert.rejects(runGuardianConfessionTick(client), /home server/);
  } finally {
    if (oldGuild === undefined) delete process.env.DISCORD_GUILD_ID;
    else process.env.DISCORD_GUILD_ID = oldGuild;
    if (previousModule) require.cache[databasePath] = previousModule;
    else delete require.cache[databasePath];
  }
});
