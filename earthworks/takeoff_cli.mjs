#!/usr/bin/env node
// Command-line take-off for an excavation layout plan (vector PDF): platforms from the toe-line pen, the boundary,
// the pre-cut, slope rules and stages from the sections, and the quantities in bill units. Same engine as the app.
//   node takeoff_cli.mjs plan.pdf [--page 1] [--scale auto|1000] [--egl 5.5] [--precut 4] [--rules "1V:1H to -6, 1V:2.5H"]
//        [--berms "3 @ -18, 3 @ -12, 3 @ -6, 5 @ 0"] [--stages "+4,+2,0,-2,...,-24"] [--oa-top -6] [--pen auto|<key>]
//        [--boundary largest|<key>] [--cell 1] [--out takeoff.csv] [--loa]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pageTextItems, pageGeometry } from "./pdfgeom.js";
import { platformsFromPolys } from "./dxf.js";
import { parseSpotLevels, declaredScaleFromText, scaleFromDeclared, scaledTransform, slopeRules, parseSlopeText, parseBermText, formatRules, designSurface, flatSurface, gridVolumes, polygonArea, gradientsInText, toCSV } from "./engine.js";

const args = process.argv.slice(2); const file = args.find(a => !a.startsWith("--")); if (!file) { console.error("usage: node takeoff_cli.mjs plan.pdf [options]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; }; const flag = k => args.includes("--" + k);
const PAGE = +opt("page", 1), EGL = +opt("egl", 5.5), PRECUT = opt("precut", "4") === "none" ? null : +opt("precut", 4), CELL = +opt("cell", 1), OATOP = +opt("oa-top", -6);
const RULES = opt("rules", "1V:1H to -6, 1V:2.5H"), BERMS = opt("berms", "3 @ -18, 3 @ -12, 3 @ -6, 5 @ 0");
const STAGES = (opt("stages", "+4,+2,0,-2,-4,-6,-8,-10,-12,-14,-16,-18,-20,-22,-24").match(/[+-]?\d+(?:\.\d+)?/g) || []).map(Number);
const here = path.dirname(fileURLToPath(import.meta.url));
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), standardFontDataUrl: path.join(here, "node_modules/pdfjs-dist/standard_fonts/") }).promise;
const page = await doc.getPage(PAGE); const vp = page.getViewport({ scale: 1 }); const items = await pageTextItems(page); const geom = await pageGeometry(page, pdfjs.OPS);
const fmt = (v, d = 0) => v == null || v === "" ? "" : Number(v).toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });

// scale
let scale = opt("scale", "auto"); scale = scale === "auto" ? declaredScaleFromText(items) : +scale; if (!scale) { console.error("No 'SCALE 1:n' found in the title block; pass --scale n"); process.exit(2); }
const T = scaledTransform(scaleFromDeclared(scale)); const m = ([x, y]) => T.toWorld(x, y);
console.log(`Sheet ${path.basename(file)} page ${PAGE}: ${fmt(vp.width)} × ${fmt(vp.height)} pt, scale 1:${scale} (${T.mPerPt.toFixed(5)} m/pt) → ${fmt(vp.width * T.mPerPt)} × ${fmt(vp.height * T.mPerPt)} m`);
// levels and gradients
const levels = parseSpotLevels(items, { min: -60, max: 200 }).filter(l => l.datum); const lt = levels.map(l => ({ x: l.x, y: l.y, value: l.value, raw: l.raw }));
console.log(`Levels to datum on the sheet: ${levels.length}; gradients written: ${gradientsInText(items).map(g => `${g.text}×${g.count}`).join(", ") || "none"}`);
// pens: closed outlines and how many hold a level label
// each level label belongs to the smallest closed outline around it (across every pen), so concentric berm and
// top-of-slope outlines do not claim the labels: the pen that owns the most labels draws the toe lines
const frameLike = q => (q.bbox.x1 - q.bbox.x0) > 0.9 * vp.width && (q.bbox.y1 - q.bbox.y0) > 0.9 * vp.height;
const allClosed = geom.paths.filter(q => q.closed && q.pts.length > 2 && !frameLike(q)).map(q => ({ ...q, layer: q.pen.key }));
const owned = platformsFromPolys(allClosed, lt, { minArea: 20 }).filter(c => c.labels.length); const ownedByPen = {}; for (const c of owned) ownedByPen[c.layer] = (ownedByPen[c.layer] || 0) + c.labels.length;
const pens = Object.values(geom.pens).filter(p => p.closed > 0).map(p => { const polys = geom.paths.filter(q => q.pen.key === p.key && q.closed && q.pts.length > 2); const cands = platformsFromPolys(polys, lt, { minArea: 20 }); return { ...p, labelled: ownedByPen[p.key] || 0, cands }; }).sort((a, b) => b.labelled - a.labelled || b.closed - a.closed);
console.log("Pens with closed outlines (colour / width pt / dash: closed outlines, level labels they own):"); for (const p of pens.slice(0, 12)) console.log(`  ${p.key.padEnd(26)} ${String(p.closed).padStart(5)} closed  ${String(p.labelled).padStart(4)} labels`);
const penKey = opt("pen", "auto") === "auto" ? (pens[0] && pens[0].labelled ? pens[0].key : null) : opt("pen"); if (!penKey) { console.error("No pen has closed outlines with a level inside; pass --pen <key> or trace in the app"); process.exit(2); }
const toe = pens.find(p => p.key === penKey); console.log(`Toe-line pen: ${penKey} (${toe.closed} closed outlines, owns ${toe.labelled} level labels)`);
// boundary: largest closed outline that is not the sheet frame
let bpath; const bopt = opt("boundary", "largest");
if (bopt === "largest") bpath = geom.paths.filter(q => q.closed && q.pts.length > 2 && !frameLike(q)).sort((a, b) => b.area - a.area)[0]; else bpath = geom.paths.filter(q => q.pen.key === bopt && q.closed && q.pts.length > 2).sort((a, b) => b.area - a.area)[0];
if (!bpath) { console.error("No boundary outline found"); process.exit(2); }
const boundary = bpath.pts.map(m); const boundaryArea = polygonArea(boundary); console.log(`Boundary: pen ${bpath.pen.key}, ${bpath.pts.length} vertices, ${fmt(boundaryArea)} m²`);
// platforms
const platforms = []; const skipped = [];
for (const c of toe.cands) { const poly = c.pts.map(p => T.toWorld(p.X, p.Y)); const area = polygonArea(poly);
  if (c.ambiguous && c.labels.length === 2) { const [a, b] = c.labels; platforms.push({ name: `${c.name} ramp ${a.value}→${b.value}`, poly, sides: "rules", fel: { p1: T.toWorld(a.x, a.y), z1: a.value, p2: T.toWorld(b.x, b.y), z2: b.value }, area }); }
  else if (c.fel != null) platforms.push({ name: `${c.name} @ ${c.fel.toFixed(2)}`, poly, sides: "rules", fel: c.fel, area, label: c.label });
  else skipped.push({ name: c.name, area, label: c.label }); }
if (PRECUT != null) platforms.push({ name: `PRE-CUT @ ${PRECUT.toFixed(2)} (vertical)`, poly: boundary, sides: "vertical", fel: PRECUT, area: boundaryArea });
console.log(`Platforms: ${platforms.length} (${skipped.length} closed outlines in the toe pen have no level inside and were left out)`);
for (const p of platforms) console.log(`  ${p.name.padEnd(36)} ${fmt(p.area).padStart(10)} m²`); for (const s of skipped) console.log(`  (no level) ${s.name.padEnd(25)} ${fmt(s.area).padStart(10)} m²  ${s.label}`);
// compute
const rules = slopeRules(parseSlopeText(RULES) || [{ top: Infinity, H: 1 }], parseBermText(BERMS)); const egl = flatSurface(EGL);
const design = designSurface(platforms, rules, egl, { corners: "mitred", top: EGL }); const t0 = Date.now();
const r = gridVolumes(boundary, egl, design, { cell: CELL, bands: [1.5, 3, 6], sample: "centre", levels: STAGES }); const s = r.summary;
console.log(`\nExisting ${EGL >= 0 ? "+" : ""}${EGL.toFixed(2)} mSHD · rules ${formatRules(rules)} · cell ${CELL} m · ${fmt(r.cells.length)} cells in ${Date.now() - t0} ms`);
console.log(`Total cut ${fmt(s.cut)} m³ · deepest ${s.maxDepth.toFixed(2)} m · slope faces ${fmt(s.slopeArea)} m² · berms ${fmt(s.bermArea)} m²`);
console.log("Stage volumes (m³):"); for (const n of s.levelBands) console.log(`  ${n.padEnd(20)} ${fmt(s.byLevel[n]).padStart(12)}`);
const above = s.levelBands.filter(n => { const mm = n.match(/([+-]?\d+\.\d+) to|above ([+-]?\d+\.\d+)/); const lo = mm ? parseFloat(mm[1] ?? mm[2]) : null; return lo != null && lo >= OATOP - 1e-9; }).reduce((t, n) => t + s.byLevel[n], 0);
console.log(`Material split at ${OATOP.toFixed(2)} mSHD: fill / marine ${fmt(above)} m³, Old Alluvium ${fmt(s.cut - above)} m³`);
console.log("Per platform (governing column: footprint + its slopes):"); for (const p of platforms) { const a = s.byTag[p.name] || { cut: 0, area: 0 }, b = s.byTag[p.name + " slopes"] || { cut: 0, slopeArea: 0, bermArea: 0 }; console.log(`  ${p.name.padEnd(36)} cut ${fmt(a.cut + b.cut).padStart(11)}  footprint ${fmt(a.area).padStart(9)} m²  slopes ${fmt(b.slopeArea || 0).padStart(8)} m²  berms ${fmt(b.bermArea || 0).padStart(7)} m²`); }
// LOA comparison (T5B/SCA/002(CE) Appendix A, Bill B) when asked
if (flag("loa")) {
  const stageName = k => k === 0 ? `above ${STAGES[0] >= 0 ? "+" : ""}${STAGES[0].toFixed(2)}` : k < STAGES.length ? `${STAGES[k] >= 0 ? "+" : ""}${STAGES[k].toFixed(2)} to ${STAGES[k - 1] >= 0 ? "+" : ""}${STAGES[k - 1].toFixed(2)}` : `below ${STAGES[STAGES.length - 1] >= 0 ? "+" : ""}${STAGES[STAGES.length - 1].toFixed(2)}`;
  const loaStages = [426295, 388911, 388353, 325571, 308581, 272752, 227150, 214809, 182788, 130870, 83567, 49611, 9552];
  const rows = [["B.B.1", "Site clearance", "m2", 838367, boundaryArea], ["B.C.1a", "Pre-cut +5.5 to +4.0 (n.e. 2 m)", "m3", 222126, s.byLevel[stageName(0)] ?? 0]];
  loaStages.forEach((q, i) => rows.push([`B.C.${i + 2}`, `Excavation ${2 * (i + 1)}–${2 * (i + 2)} m stage (${stageName(i + 1)})`, "m3", q, s.byLevel[stageName(i + 1)] ?? 0]));
  rows.push(["B.C.15", `Deeper than 28 m (${stageName(STAGES.length)})`, "m3", null, s.byLevel[stageName(STAGES.length)] ?? 0]);
  rows.push(["B.C.total", "Excavation incl. strutting 400,155", "m3", 3631091, s.cut]);
  rows.push(["B.D.1", "Fill material available", "m3", 1332464, above], ["B.D.2", "OA material available", "m3", 687241, s.cut - above]);
  rows.push(["B.G.2.a.a", "Cement canvas, slope faces", "m2", 107403, s.slopeArea], ["B.G.2.b.a", "Cement canvas, berms", "m2", 13542, s.bermArea], ["B.G.2.c", "Demolition of cement canvas", "m2", 120945, s.slopeArea + s.bermArea]);
  console.log("\nLOA Appendix A (Bill B) with the take-off adjacent:"); console.log(`  ${"Item".padEnd(10)} ${"Description".padEnd(46)} ${"Unit".padEnd(4)} ${"LOA qty".padStart(12)} ${"Take-off".padStart(12)} ${"Diff".padStart(12)}`);
  for (const [it, d, u, q, tk] of rows) console.log(`  ${it.padEnd(10)} ${d.padEnd(46)} ${u.padEnd(4)} ${fmt(q).padStart(12)} ${fmt(tk).padStart(12)} ${(q == null ? "" : fmt(tk - q)).padStart(12)}`);
  if (opt("out")) fs.writeFileSync(opt("out"), toCSV(rows.map(([item, description, unit, loa_qty, takeoff_qty]) => ({ item, description, unit, loa_qty: loa_qty ?? "", takeoff_qty: takeoff_qty.toFixed(1), difference: loa_qty == null ? "" : (takeoff_qty - loa_qty).toFixed(1) })), ["item", "description", "unit", "loa_qty", "takeoff_qty", "difference"]));
} else if (opt("out")) fs.writeFileSync(opt("out"), toCSV([{ boundary_area_m2: boundaryArea.toFixed(1), cut_total_m3: s.cut.toFixed(1), slope_face_area_m2: s.slopeArea.toFixed(1), berm_area_m2: s.bermArea.toFixed(1), ...Object.fromEntries(s.levelBands.map(n => ["stage_" + n.replace(/\s+/g, "_") + "_m3", s.byLevel[n].toFixed(1)])) }], null));
if (opt("out")) console.log(`\nWritten ${opt("out")}`);
