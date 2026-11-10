const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PgDialect, pgTable, integer } = require('drizzle-orm/pg-core');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
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

test('both weekly guardians and member submissions use the same stored anonymous confession and reply button', async () => {
  const oldGuild = process.env.DISCORD_GUILD_ID;
  const oldLilith = process.env.LILITH_BOT_ID;
  process.env.DISCORD_GUILD_ID = 'home';
  process.env.LILITH_BOT_ID = 'lilith-bot';
  const rows = [], sent = [], submissions = [], updates = [];
  const initialized = new Set();
  const dialect = new PgDialect();
  const databasePath = require.resolve('../src/lib/database.ts');
  const previousModule = require.cache[databasePath];
  const confessionTable = pgTable('faye_confessions', { id: integer('id') });
  const db = {
    insert: table => ({ values: values => ({ returning: async () => {
      assert.equal(table, confessionTable);
      const record = { id: submissions.length + 1, ...values };
      submissions.push(record);
      return [record];
    } }) }),
    update: table => ({ set: value => ({ where: async () => {
      assert.equal(table, confessionTable);
      updates.push(value);
    } }) }),
    select: () => ({ from: () => ({ where: async () => [{ guildId: 'home', confessionsChannelId: 'confessions' }] }) }),
    execute: async sql => {
      const query = dialect.sqlToQuery(sql), p = query.params;
      const table = query.sql.includes('faye_lilith_guardian_confession_posts') ? 'lilith' : 'faye';
      if (query.sql.includes('CREATE TABLE')) {
        for (const field of ['guild_id', 'content', 'status', 'message_id']) assert.match(query.sql, new RegExp(field + ' TEXT'));
        initialized.add(table);
        return { rows: [] };
      }
      if (query.sql.includes('SELECT confessions_channel_id')) return { rows: [{ confessions_channel_id: 'confessions' }] };
      if (query.sql.includes('SELECT week_start')) return { rows: rows.filter(r => r.table === table && r.guild === p[0] && +r.week === +p[1]) };
      if (query.sql.includes('SELECT content')) return { rows: [...rows].filter(r => r.table === table).reverse().slice(0, p[1]) };
      if (query.sql.includes('INSERT INTO')) {
        if (rows.some(r => r.table === table && r.guild === p[0] && +r.week === +p[1])) return { rows: [] };
        rows.push({ table, guild: p[0], week: p[1], due: p[2], content: p[3], status: 'pending' });
        return { rows: [{ scheduled_at: p[2] }] };
      }
      if (query.sql.includes("SET status = 'sending'")) {
        const found = rows.filter(r => r.table === table && r.guild === p[0] && +r.week === +p[1] && r.due <= new Date() && r.status === 'pending');
        found.forEach(r => { r.status = 'sending'; });
        return { rows: found.map(r => ({ content: r.content, week_start: r.week })) };
      }
      if (query.sql.includes("SET status = 'posted'")) {
        rows.find(r => r.table === table && r.guild === p[1] && +r.week === +p[2]).status = 'posted';
        return { rows: [] };
      }
      throw new Error(query.sql);
    }
  };
  require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
    exports: { db, confessions: confessionTable, guildConfig: {} } };
  const guild = { members: { me: {} } };
  let embedLinks = true;
  const channel = { id: 'confessions', guildId: 'home', type: ChannelType.GuildText, guild,
    permissionsFor: () => ({ has: bit => bit === PermissionFlagsBits.EmbedLinks ? embedLinks : true }),
    send: async payload => { sent.push(payload); return { id: 'message-' + sent.length }; } };
  const client = { user: { id: 'faye-bot' }, guilds: { fetch: async () => guild }, channels: { fetch: async () => channel } };
  channel.client = client;
  try {
    const { runGuardianConfessionTick, startGuardianConfessions } = require('../src/lib/guardianConfessionScheduler.ts');
    startGuardianConfessions(client);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(initialized.size, 2);
    assert.equal(rows.length, 4);
    assert.equal(sent.length, 0);
    const savedDates = rows.map(r => +r.due);
    await runGuardianConfessionTick(client);
    await runGuardianConfessionTick(client, 'lilith');
    assert.deepEqual(rows.map(r => +r.due), savedDates);
    const week = +confessionWeek(new Date());
    rows.filter(r => +r.week === week).forEach(r => { r.due = new Date(0); });
    rows.push({ table: 'faye', guild: 'home', week: new Date(week - WEEK_MS), due: new Date(0), content: 'old', status: 'pending' });
    await Promise.all([runGuardianConfessionTick(client), runGuardianConfessionTick(client), runGuardianConfessionTick(client, 'lilith'), runGuardianConfessionTick(client, 'lilith')]);
    await runGuardianConfessionTick(client);
    assert.equal(sent.length, 2);
    assert.deepEqual(submissions.map(r => r.username).sort(), ['Faye', 'Lilith']);
    assert.deepEqual(submissions.map(r => r.userId).sort(), ['faye-bot', 'lilith-bot']);
    for (let i = 0; i < sent.length; i++) {
      assert.match(sent[i].embeds[0].data.title, new RegExp('Confession #' + submissions[i].id));
      assert.equal(sent[i].embeds[0].data.footer.text, 'Anonymous · Garden of Harmony 🍃');
      assert.equal(sent[i].components[0].components[0].data.custom_id, 'confess-reply_' + submissions[i].id);
      assert.deepEqual(sent[i].allowedMentions, { parse: [] });
    }
    assert.equal(updates.length, 2);
    assert.equal(rows.at(-1).status, 'pending');
    // A member's existing command goes through the identical backend.
    const command = require('../src/commands/confess.ts');
    const interaction = { guildId: 'home', client, user: { id: 'member', username: 'Private Member' },
      deferReply: async () => {}, editReply: async () => {},
      options: { getSubcommand: () => 'submit', getString: name => name === 'message' ? 'My secret' : 'Funny' } };
    // The command's existing Drizzle filter needs a real guild_id column.
    const { guildConfig } = require.cache[databasePath].exports;
    guildConfig.guildId = integer('guild_id');
    await command.execute(interaction);
    assert.equal(submissions[2].userId, 'member');
    assert.equal(submissions[2].content, 'My secret');
    assert.equal(submissions[2].category, 'Funny');
    assert.equal(sent[2].embeds[0].data.footer.text, 'Anonymous · Garden of Harmony 🍃');
    embedLinks = false;
    const { publishConfession } = require('../src/lib/confessionService.ts');
    await publishConfession({ channel, userId: 'faye-bot', username: 'Faye', content: 'A text confession' });
    assert.match(sent[3].content, /Confession #4/);
    assert.equal(sent[3].embeds, undefined);
    assert.equal(sent[3].components[0].components[0].data.custom_id, 'confess-reply_4');
    channel.guildId = 'wrong-server';
    await assert.rejects(runGuardianConfessionTick(client), /home server/);
  } finally {
    if (oldGuild === undefined) delete process.env.DISCORD_GUILD_ID; else process.env.DISCORD_GUILD_ID = oldGuild;
    if (oldLilith === undefined) delete process.env.LILITH_BOT_ID; else process.env.LILITH_BOT_ID = oldLilith;
    if (previousModule) require.cache[databasePath] = previousModule; else delete require.cache[databasePath];
  }
});
