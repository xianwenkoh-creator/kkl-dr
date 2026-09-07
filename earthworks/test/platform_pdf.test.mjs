import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pageTextItems, pageGeometry } from "../pdfgeom.js";
import { parseSpotLevels, gradientsInText, declaredScaleFromText, scaleFromDeclared, scaledTransform, slopeRules, parseSlopeText, parseBermText, designSurface, flatSurface, gridVolumes } from "../engine.js";
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = path.join(here, "..");
const truth = JSON.parse(fs.readFileSync(path.join(dir, "sample_platforms.truth.json"), "utf8"));
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, "sample_platforms.pdf"))), standardFontDataUrl: path.join(dir, "node_modules/pdfjs-dist/standard_fonts/") }).promise;
const page = await doc.getPage(1); const items = await pageTextItems(page);

test("ERSS-style plan: platform labels read with sign and datum, sitting where they are written; decoys ignored", () => {
  const levels = parseSpotLevels(items, { min: -50, max: 200 });
  for (const p of truth.platforms.filter(p => p.label)) {
    const want = typeof p.fel === "number" ? p.fel : null; const near = levels.filter(l => Math.hypot(l.x - p.label_pt[0], l.y - p.label_pt[1]) < 3);
    assert.equal(near.length, 1, `label for ${p.name} at ${p.label_pt}: ${JSON.stringify(near.map(l => l.raw))}`); assert.equal(near[0].value, want); assert.equal(near[0].datum, "SHD");
  }
  const vals = levels.map(l => l.value); for (const v of [-12, -18, -21.6, -6, 4, 5.5, -5.5, 0, -10.8, -7.2]) assert.ok(vals.includes(v), `missing ${v}`);
  assert.ok(!vals.includes(173.6) && !vals.includes(5) && !vals.includes(3) && !vals.includes(36) && !vals.includes(1125) && !vals.includes(12000) && !vals.includes(2.5), "a decoy leaked: " + vals.join(","));
  const g = gradientsInText(items); assert.deepEqual(g.map(x => x.text).sort(), ["1V:0.5H", "1V:1H", "1V:2.5H", "1V:8.3H"]);   // the notes carry the ramp gradient 1:8.3
  assert.equal(declaredScaleFromText(items), 1000);
});
test("platform excavation on the sample plan agrees with the independent numpy truth", () => {
  const T = scaledTransform(scaleFromDeclared(1000)); const m = ([x, y]) => T.toWorld(x, y);
  const boundary = truth.boundary_pt.map(m); const egl = flatSurface(truth.egl);
  const rules = slopeRules(parseSlopeText(truth.rules_text), parseBermText(truth.berms_text));
  const platforms = truth.platforms.map(p => ({ name: p.name, poly: p.poly_pt.map(m), sides: p.sides, fel: typeof p.fel === "number" ? p.fel : { p1: { X: p.fel.p1[0], Y: p.fel.p1[1] }, z1: p.fel.z1, p2: { X: p.fel.p2[0], Y: p.fel.p2[1] }, z2: p.fel.z2 } }));
  const d = designSurface(platforms, rules, egl, { top: truth.egl }); const t0 = Date.now();
  const r = gridVolumes(boundary, egl, d, { cell: 0.5, bands: [1.5, 3, 6], levels: truth.stages, sample: "centre" }); const ms = Date.now() - t0;   // 0.5 m so the 3.6 m sump ring is attributed cleanly
  const pct = (a, b) => Math.abs(a - b) / b;
  assert.ok(pct(r.summary.cut, truth.cut_m3) < 0.005, `total ${r.summary.cut.toFixed(0)} vs ${truth.cut_m3}`); assert.ok(pct(r.summary.area, truth.area_m2) < 0.002);
  for (const [k, v] of Object.entries(truth.cut_by_tag_m3)) assert.ok(pct(r.summary.byTag[k]?.cut ?? 0, v) < 0.005, `tag ${k}: ${r.summary.byTag[k]?.cut?.toFixed(0)} vs ${v}`);
  const tagLayers = Object.values(r.summary.byTag).reduce((s, t) => s + Object.values(t.byLayer).reduce((a, b) => a + b, 0), 0); assert.ok(Math.abs(tagLayers - r.summary.cut) < 1e-6, "per-tag depth bands sum to the cut");
  const r1 = gridVolumes(boundary, egl, d, { cell: 1, sample: "centre" }); assert.ok(pct(r1.summary.cut, truth.cut_m3) < 0.005, `1 m cells total ${r1.summary.cut.toFixed(0)}`);
  for (const [k, v] of Object.entries(truth.cut_by_level_m3)) assert.ok(pct(r.summary.byLevel[k], v) < 0.01, `level band ${k}: ${r.summary.byLevel[k].toFixed(0)} vs ${v}`);
  for (const [k, v] of Object.entries(truth.cut_by_layer_m3)) assert.ok(pct(r.summary.byLayer[k], v) < 0.01, `depth band ${k}: ${r.summary.byLayer[k].toFixed(0)} vs ${v}`);
  assert.ok(Math.abs(r.summary.maxDepth - truth.max_depth_m) < 0.01); assert.equal(r.summary.missing, 0);
  console.log(`  sample plan: ${r.cells.length} cells in ${ms} ms, cut ${r.summary.cut.toFixed(0)} m3 vs truth ${truth.cut_m3}`);
});
