import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pageTextItems, pageGeometry } from "../pdfgeom.js";
import { parseSpotLevels, clusterMarkers, associateMarkers, georeferenceFromGrid, declaredScaleFromText, scaleFromDeclared, proximity, idw, tin, gridVolumes, batterAllowance, polygonArea } from "../engine.js";
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = path.join(here, "..");
const truth = JSON.parse(fs.readFileSync(path.join(dir, "sample_topo.truth.json"), "utf8"));
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, "sample_topo.pdf"))), standardFontDataUrl: path.join(dir, "node_modules/pdfjs-dist/standard_fonts/") }).promise;
const page = await doc.getPage(1); const items = await pageTextItems(page); const geom = await pageGeometry(page, pdfjs.OPS);
const levels = parseSpotLevels(items, { min: 90, max: 130 }); const markers = clusterMarkers(geom.markers); const placed = associateMarkers(levels, markers);

test("spot levels found, decoys excluded", () => {
  const raw = levels.map(l => l.raw);
  assert.ok(!raw.includes("12.5") && !raw.includes("21567.345") && !raw.includes("100.12"), "decoys leaked: " + raw.filter(r => ["12.5", "21567.345", "100.12"].includes(r)));
  const spots = levels.filter(l => l.prefix !== "MH");
  assert.equal(spots.length, truth.spot_count, `expected ${truth.spot_count} spot levels, got ${spots.length}`);
});
test("levels sit on their markers within 0.5 pt and values match truth", () => {
  let matched = 0, onMarker = 0;
  for (const t of truth.spots) {
    const near = placed.filter(l => Math.hypot(l.px - t.x_pt, l.py - t.y_pt) < 0.5);
    if (near.length) { matched++; if (near[0].source === "marker") onMarker++; assert.ok(Math.abs(near[0].value - t.level) < 0.0051, `value ${near[0].value} vs ${t.level}`); }
  }
  assert.ok(matched >= truth.spot_count * 0.99, `matched ${matched}/${truth.spot_count}`); assert.ok(onMarker >= truth.spot_count * 0.98, `on marker ${onMarker}`);
});
test("declared scale and grid georeference agree with truth", () => {
  assert.equal(declaredScaleFromText(items), truth.scale); assert.ok(Math.abs(scaleFromDeclared(truth.scale) - truth.pt_to_m) < 1e-9);
  const g = georeferenceFromGrid(items, geom.lines); assert.ok(g.ok, "georeference failed: " + JSON.stringify(g));
  assert.ok(Math.abs(g.mPerPt - truth.pt_to_m) / truth.pt_to_m < 0.005, `mPerPt ${g.mPerPt}`);
  const s = truth.spots[10]; const w = g.toWorld(s.x_pt, s.y_pt); assert.ok(Math.abs(w.X - s.e) < 0.3 && Math.abs(w.Y - s.n) < 0.3, `E/N off: ${w.X - s.e}, ${w.Y - s.n}`);
});
test("cut and fill per zone within 2 percent of the analytic truth, all methods", () => {
  const g = georeferenceFromGrid(items, geom.lines); const pts = placed.map(l => ({ ...g.toWorld(l.px, l.py), z: l.value }));
  for (const [name, z] of Object.entries(truth.zones)) {
    const poly = z.poly_en.map(([X, Y]) => ({ X, Y })); assert.ok(Math.abs(polygonArea(poly) - z.area_m2) < 0.5);
    for (const [label, surf] of [["proximity", proximity(pts, { k: 4, radius: 25 })], ["idw", idw(pts, { k: 6, radius: 30 })], ["tin", tin(pts)]]) {
      const r = gridVolumes(poly, surf, z.fel, { cell: 1, bands: [1.5, 3, 6] }); const err = (r.summary.cut - z.cut_m3) / z.cut_m3;
      assert.ok(Math.abs(err) < 0.02, `zone ${name} ${label}: cut ${r.summary.cut.toFixed(0)} vs ${z.cut_m3} (${(err * 100).toFixed(1)}%)`);
      assert.ok(Math.abs(r.summary.area - z.area_m2) < z.area_m2 * 0.01, `area ${r.summary.area}`);
      const layers = Object.values(r.summary.byLayer).reduce((s, v) => s + v, 0); assert.ok(Math.abs(layers - r.summary.cut) < 1e-6, "layers must sum to cut");
      const maxd = Object.values(r.summary.byMaxDepth).reduce((s, v) => s + v, 0); assert.ok(Math.abs(maxd - r.summary.cut) < 1e-6);
      if (label === "tin") for (const b of Object.keys(z.cut_by_layer_m3)) assert.ok(Math.abs(r.summary.byLayer[b] - z.cut_by_layer_m3[b]) < Math.max(60, z.cut_by_layer_m3[b] * 0.03), `zone ${name} band ${b}: ${r.summary.byLayer[b].toFixed(0)} vs ${z.cut_by_layer_m3[b]}`);
      assert.equal(r.summary.missing, 0);
    }
    const batter = batterAllowance(poly, tin(pts), z.fel, 1); assert.ok(batter > 0 && batter < z.cut_m3, `batter ${batter}`);
  }
});
