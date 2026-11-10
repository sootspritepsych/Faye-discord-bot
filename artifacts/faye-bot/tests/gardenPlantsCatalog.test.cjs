const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GARDEN_PLANT_CATALOG, availableGardenPlants, currentPlantSeason,
  isPlantAvailable, plantEmoji, plantMenuEmoji, plantLabel,
} = require("../src/lib/gardenPlantsCatalog.ts");

test("all 24 species have unique and permanent IDs", () => {
  assert.equal(GARDEN_PLANT_CATALOG.length, 24);
  assert.equal(new Set(GARDEN_PLANT_CATALOG.map(p => p.key)).size, 24);
  assert.equal(GARDEN_PLANT_CATALOG.filter(p => p.season === "all").length, 8);
});

for (const [month, season, species] of [
  [1, "winter", "snowdrop"],
  [4, "spring", "cherry_blossom"],
  [7, "summer", "lotus"],
  [10, "autumn", "red_maple"],
]) {
  test("in month " + month + " only " + season + " seeds are available", () => {
    const d = new Date("2026-" + String(month).padStart(2, "0") + "-15T18:00:00Z");
    assert.equal(currentPlantSeason(d), season);
    const available = availableGardenPlants(d);
    assert.equal(available.length, 12);
    assert(available.some(p => p.key === species));
    assert(available.some(p => p.key === "rose"));
    assert(!available.some(p => p.season !== "all" && p.season !== season));
    assert.equal(isPlantAvailable(species, d), true);
    assert.equal(isPlantAvailable("nonexistent", d), false);
  });
}

test("custom emoji is used if present and Unicode is a safe fallback", () => {
  assert.equal(plantEmoji("cherry_blossom", null), "🌸");
  assert.equal(plantMenuEmoji("snowdrop", null), "❄️");
  const custom = { id: "123456789012345678", name: "plant_snowdrop", animated: false,
    toString: () => "<:plant_snowdrop:123456789012345678>" };
  const guild = { emojis: { cache: { find: predicate => predicate(custom) ? custom : undefined } } };
  assert.equal(plantEmoji("snowdrop", guild), custom.toString());
  assert.deepEqual(plantMenuEmoji("snowdrop", guild),
    { id: custom.id, name: custom.name, animated: false });
  assert.equal(plantLabel("snowdrop"), "Snowdrop");
});
