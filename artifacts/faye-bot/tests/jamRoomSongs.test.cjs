const { test } = require("node:test");
const assert = require("node:assert/strict");
const { jamDay, SONGS, SONG_MOODS, songCandidates, leastPlayed, normalizedJamName } = require("../src/lib/jamRoomCatalog.ts");

test("alternation crosses months and years without resetting", () => {
  for (const [day, sister] of [["2026-11-10", "faye"], ["2026-11-11", "lilith"], ["2026-11-30", "faye"], ["2026-12-01", "lilith"], ["2027-01-01", "faye"]]) {
    assert.equal(jamDay(new Date(day + "T23:00:00Z")).sister, sister);
  }
});
test("Chicago time follows daylight saving and local midnight", () => {
  assert.equal(jamDay(new Date("2027-03-13T23:00:00Z")).hour, 17);
  assert.equal(jamDay(new Date("2027-03-14T22:00:00Z")).hour, 17);
  assert.equal(jamDay(new Date("2026-11-11T05:59:00Z")).date, "2026-11-10");
  assert.equal(jamDay(new Date("2026-11-11T06:00:00Z")).sister, "lilith");
});
test("every mood has choices and daily pools do not overlap", () => {
  assert.equal(new Set(SONGS.map(s => s.id)).size, SONGS.length);
  assert(SONGS.length >= 30);
  for (const sister of ["faye", "lilith"]) for (const mood of SONG_MOODS) {
    assert(songCandidates(sister, mood.value).length >= 2);
  }
  const faye = new Set(songCandidates("faye", "surprise").map(s => s.id));
  assert(songCandidates("lilith", "surprise").every(s => !faye.has(s.id)));
  for (const song of SONGS) assert.match(song.id, /^[a-zA-Z0-9]{22}$/);
});
test("shuffle exhausts unused songs before repeats", () => {
  const songs = songCandidates("faye", "surprise");
  const counts = new Map(songs.slice(1).map(s => [s.id, 1]));
  assert.deepEqual(leastPlayed(songs, counts), [songs[0]]);
  counts.set(songs[0].id, 1);
  assert.equal(leastPlayed(songs, counts).length, songs.length);
});
test("channel names with Discord decoration resolve consistently", () => {
  assert.equal(normalizedJamName("🎶︱jam-room"), "jamroom");
  assert.equal(normalizedJamName("Jam Room"), "jamroom");
  assert.notEqual(normalizedJamName("other-jam-room"), "jamroom");
});

test("daily reservations prevent duplicate sends across repeated calls", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-10T23:00:00Z") });
  process.env.DATABASE_URL ||= "postgres://unused:unused@localhost/unused";
  process.env.DISCORD_GUILD_ID = "123456789012345678";
  const { Collection, ChannelType } = require("discord.js");
  const { db } = require("../src/lib/database.ts");
  const { postSong } = require("../src/lib/jamRoomSongs.ts");
  let reserved = false, sends = 0;
  t.mock.method(db, "execute", async () => ({ rows: [] }));
  t.mock.method(db, "transaction", async fn => {
    let step = 0;
    return fn({ execute: async () => {
      step++;
      if (step === 1) return { rows: [{ locked: true }] };
      if (step === 2) return { rows: reserved ? [{}] : [] };
      if (step === 3) return { rows: [] };
      reserved = true; return { rows: [{ post_key: "daily" }] };
    }});
  });
  const channel = { id: "jam", name: "🎶︱jam-room", type: ChannelType.GuildText,
    isTextBased: () => true, isSendable: () => true,
    permissionsFor: () => ({ has: () => true }), send: async options => {
      sends++; assert.equal(options.enforceNonce, true);
      assert.match(options.content, /https:\/\/open.spotify.com\/track\//);
      return { id: "sent" };
    }};
  const guild = { id: process.env.DISCORD_GUILD_ID, members: { me: {} },
    channels: { fetch: async () => new Collection([["jam", channel]]) }};
  await postSong(guild, "daily:test", "surprise");
  await postSong(guild, "daily:test", "surprise");
  assert.equal(sends, 1);
  await assert.rejects(postSong({ ...guild, id: "foreign" }, "bad", "cozy"), /home server/);
  t.mock.timers.reset();
});
