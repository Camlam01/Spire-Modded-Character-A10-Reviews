import { test } from "node:test";
import assert from "node:assert/strict";
import { characterName, isModdedCharacter, isVerified, matchCharactersToTitle, modPrefix, parseRunFile, steamIdFromPath, tallyRuns } from "./runs.ts";

const ME = "76561190000000001";

// Shaped like a real STS2 history file (schema_version 10), trimmed to the fields the parser reads.
const run = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    acts: ["ACT.UNDERDOCKS"],
    ascension: 10,
    build_id: "v0.111.0",
    game_mode: "standard",
    players: [{ character: "CHARACTER.THETAILOR-THE_TAILOR", id: 1 }],
    run_time: 3861,
    schema_version: 10,
    seed: "X2P0GT4RVYJT",
    start_time: 1792154405,
    was_abandoned: false,
    win: false,
    ...over,
  });

test("parses a solo A10 run", () => {
  const r = parseRunFile(run({ win: true }), "1792154405.run", ME);
  assert.deepEqual(r, {
    ok: true,
    run: { characterId: "CHARACTER.THETAILOR-THE_TAILOR", seed: "X2P0GT4RVYJT", startTime: 1792154405, ascension: 10, runTime: 3861, buildId: "v0.111.0", win: true },
  });
});

test("skips runs that shouldn't count", () => {
  const reason = (text: string, path = "x.run") => { const r = parseRunFile(text, path, ME); return r.ok ? "ok" : r.reason; };
  assert.equal(reason("{not json"), "not_json");
  assert.equal(reason(JSON.stringify({ hello: 1 })), "unknown_format");
  assert.equal(reason(run({ was_abandoned: true })), "abandoned");
  assert.equal(reason(run({ game_mode: "custom" })), "not_standard");
  assert.equal(reason(run({ ascension: 9 })), "below_a10");
  assert.equal(reason(run({ win: false })), "ok"); // losses count
  assert.equal(reason(run({ players: [{ character: "CHARACTER.SILENT", id: 1 }, { character: "CHARACTER.IRONCLAD", id: 2 }] })), "coop");
  assert.equal(reason(run(), "1700000000.run"), "name_mismatch");
  assert.equal(reason(run({ seed: "bad seed!" })), "unknown_format");
  assert.equal(reason(run(), "SlayTheSpire2/steam/76561190000000002/modded/profile1/saves/history/1792154405.run"), "other_account_folder");
  assert.equal(reason(run(), `SlayTheSpire2/steam/${ME}/modded/profile1/saves/history/1792154405.run`), "ok");
});

test("tallies A10 runs and wins per modded character and drops duplicates and base-game runs", () => {
  const a = parseRunFile(run({ win: true }), "a.run", ME);
  const b = parseRunFile(run(), "b.run", ME); // same run from another profile copy
  const c = parseRunFile(run({ seed: "ABC", start_time: 1 }), "c.run", ME);
  const d = parseRunFile(run({ seed: "DEF", start_time: 2, players: [{ character: "CHARACTER.IRONCLAD", id: 1 }] }), "d.run", ME);
  const { unique, byCharacter } = tallyRuns([a, b, c, d].flatMap((r) => (r.ok ? [r.run] : [])));
  assert.equal(unique.length, 2);
  assert.deepEqual(byCharacter, [{ characterId: "CHARACTER.THETAILOR-THE_TAILOR", a10Runs: 2, a10Wins: 1, lastPlayed: 1792154405 }]);
});

test("verified at 10 A10 runs or 3 A10 wins", () => {
  assert.equal(isVerified({ a10Runs: 9, a10Wins: 2 }), false);
  assert.equal(isVerified({ a10Runs: 10, a10Wins: 0 }), true);
  assert.equal(isVerified({ a10Runs: 3, a10Wins: 3 }), true);
  assert.equal(isVerified(null), false);
});

test("matches Workshop titles to characters by mod prefix", () => {
  const known = [
    "CHARACTER.IRONCLAD",
    "CHARACTER.THETAILOR-THE_TAILOR",
    "CHARACTER.SEABOURNE-SEABOURNE",
    "CHARACTER.SEABOURNE-THE_SEABOURNE",
    "CHARACTER.SB-SPARKY",
  ];
  assert.deepEqual(matchCharactersToTitle("The Tailor (Beta Branch)", known), ["CHARACTER.THETAILOR-THE_TAILOR"]);
  assert.deepEqual(matchCharactersToTitle("The Seabourne", known), ["CHARACTER.SEABOURNE-SEABOURNE", "CHARACTER.SEABOURNE-THE_SEABOURNE"]);
  assert.deepEqual(matchCharactersToTitle("SB", known), ["CHARACTER.SB-SPARKY"]); // short prefix: exact title only
  assert.deepEqual(matchCharactersToTitle("Sparky by SB Mods", known), []);
  assert.deepEqual(matchCharactersToTitle("Ironclad Rework", known), []); // base-game characters never match
});

test("character helpers", () => {
  assert.equal(isModdedCharacter("CHARACTER.THETAILOR-THE_TAILOR"), true);
  assert.equal(isModdedCharacter("CHARACTER.IRONCLAD"), false);
  assert.equal(modPrefix("CHARACTER.THETAILOR-THE_TAILOR"), "THETAILOR");
  assert.equal(characterName("CHARACTER.THETAILOR-THE_TAILOR"), "The Tailor");
  assert.equal(characterName("CHARACTER.IRONCLAD"), "Ironclad");
  assert.equal(steamIdFromPath("C:\\Users\\x\\AppData\\Roaming\\SlayTheSpire2\\steam\\76561198415814471\\modded"), "76561198415814471");
  assert.equal(steamIdFromPath("history/123.run"), null);
});
