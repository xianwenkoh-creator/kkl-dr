import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { parseDxf, platformsFromDxf, cleanMtext, levelTextsFromDxf } from "../dxf.js";
import { levelsInText, georefTwoPoints, parseCoordinateList, polygonArea } from "../engine.js";
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = path.join(here, "..");
const truth = JSON.parse(fs.readFileSync(path.join(dir, "sample_platforms.dxf.truth.json"), "utf8"));
const dxf = parseDxf(fs.readFileSync(path.join(dir, "sample_platforms.dxf"), "utf8"));

test("DXF: layers, closed polylines, texts (TEXT, MTEXT, block insert) come through in metres", () => {
  assert.deepEqual(Object.keys(dxf.layers).sort(), truth.layers.slice().sort()); assert.equal(dxf.unitsGuess, "m");
  const plat = dxf.polylines.filter(p => p.layer === "C-ERSS-PLATFORM" && p.closed); assert.equal(plat.length, truth.platforms.length + 1);
  const b = dxf.polylines.find(p => p.layer === "C-BOUNDARY"); assert.ok(b.closed); assert.ok(Math.abs(b.area - 500 * 360) < 1e-6);
  const txt = dxf.texts.map(t => t.text); assert.ok(txt.includes("-12.00m SHD") && txt.includes("(-21.60m SHD)") && txt.includes("-6.00m SHD"), "TEXT and block text: " + txt.join(" | "));
  assert.ok(txt.some(t => t === "B2-3 -18.00m SHD"), "MTEXT formatting stripped: " + txt.find(t => t.includes("18.00")));
  assert.equal(cleanMtext("{\\fArial|b0|i0;\\H0.7x;LEVEL\\P-12.00m SHD}"), "LEVEL -12.00m SHD");
  const blockLabel = dxf.texts.find(t => t.text === "-6.00m SHD" && Math.abs(t.x - (45900 + 250)) < 1e-6 && Math.abs(t.y - (35000 + 380)) < 1e-6); assert.ok(blockLabel, "block insert expanded at its insertion point");
});
test("DXF: platforms from the toe-line layer get the level written inside them; sump keeps its own; ramp flagged", () => {
  const levelTexts = levelTextsFromDxf(dxf, levelsInText); assert.equal(levelTexts.length, 11, "eleven levels to datum (notes included): " + levelTexts.map(l => l.value).join(","));
  const plats = platformsFromDxf(dxf, ["C-ERSS-PLATFORM"], levelTexts);
  assert.equal(plats.length, truth.platforms.length + 1);
  for (const tp of truth.platforms) { const got = plats.find(p => Math.abs(p.area - tp.area) < 1e-6 && Math.abs(p.pts[0].X - tp.poly[0][0]) < 1e-6); assert.ok(got, "platform " + tp.name); assert.equal(got.fel, tp.fel, `${tp.name} level from label ${got.label}`); assert.ok(Math.abs(polygonArea(got.pts) - tp.area) < 1e-6); }
  const ramp = plats.find(p => Math.abs(p.area - truth.ramp.area) < 1e-6); assert.ok(ramp.ambiguous && ramp.fel == null, "ramp has two labels: " + ramp.label);
  const struct = dxf.polylines.filter(p => p.layer === "C-STRUCT"); assert.equal(struct.length, 1); assert.ok(!plats.some(p => Math.abs(p.area - struct[0].area) < 1e-6 && p.layer === "C-STRUCT"), "structure outline on another layer is not a platform");
});
test("two-point E/N georeference and coordinate schedules", () => {
  const g = georefTwoPoints({ x: 100, y: 100 }, { E: 45933.837, N: 35032.442 }, { x: 400, y: 100 }, { E: 45933.837 + 300 * 0.5, N: 35032.442 });
  assert.ok(g.ok); assert.ok(Math.abs(g.mPerPt - 0.5) < 1e-12 && Math.abs(g.rotationDeg) < 1e-9);
  const rot = georefTwoPoints({ x: 0, y: 0 }, { E: 1000, N: 2000 }, { x: 0, y: 100 }, { E: 1000 + 50, N: 2000 });   // page up = world east: 90 degree rotation
  const w = rot.toWorld(10, 0); assert.ok(Math.abs(w.X - 1000) < 1e-9 && Math.abs(w.Y - (2000 - 5)) < 1e-9, JSON.stringify(w)); const back = rot.fromWorld(w.X, w.Y); assert.ok(Math.abs(back.x - 10) < 1e-9 && Math.abs(back.y) < 1e-9);
  const pts = parseCoordinateList("N:33928.596 E:45453.018\nN:35032.442 E:45933.837 N:35049.488 E:45941.077\nN=36389.940 E=46383.439\n45500.25, 35100.5");
  assert.deepEqual(pts, [{ E: 45453.018, N: 33928.596 }, { E: 45933.837, N: 35032.442 }, { E: 45941.077, N: 35049.488 }, { E: 46383.439, N: 36389.94 }, { E: 45500.25, N: 35100.5 }]);
});
