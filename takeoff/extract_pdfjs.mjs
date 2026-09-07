#!/usr/bin/env node
// Feasibility spike: the same measurement with pdf.js, i.e. the route that runs inside a browser
// page like ai/index.html with no server. Walks the operator list, tracks graphics state, measures.
// Usage: node extract_pdfjs.mjs [sample_drawing.pdf]   (needs: npm install pdfjs-dist@4.10.38)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(here, "sample_drawing.pdf");
const OPS = pdfjs.OPS;
const fontDir = path.join(path.dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json"))), "standard_fonts/");
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), standardFontDataUrl: fontDir }).promise;
const page = await doc.getPage(1);

// 1. scale from text
const tc = await page.getTextContent();
const words = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }));
const scaleMatch = words.map(w => w.str).join(" ").match(/SCALE\s*1\s*:\s*(\d+)/i);
const scale = scaleMatch ? +scaleMatch[1] : null;
if (!scale) throw new Error("no scale text");
const PT_TO_M = 25.4 / 72 / 1000 * scale;

// 2. walk the operator list with a graphics-state stack
const ol = await page.getOperatorList();
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const apply = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
let gs = { ctm: [1,0,0,1,0,0], stroke: [0,0,0], fill: [0,0,0], width: 1 }; const stack = [];
let pending = null; const paths = [];
const norm = c => Array.from(c).map(v => Math.round((v > 1 ? v / 255 : v) * 100) / 100);
for (let i = 0; i < ol.fnArray.length; i++) {
  const fn = ol.fnArray[i], a = ol.argsArray[i];
  if (fn === OPS.save) stack.push({ ...gs });
  else if (fn === OPS.restore) gs = stack.pop() || gs;
  else if (fn === OPS.transform) gs.ctm = mul(gs.ctm, a);
  else if (fn === OPS.setStrokeRGBColor) gs.stroke = norm(a);
  else if (fn === OPS.setFillRGBColor) gs.fill = norm(a);
  else if (fn === OPS.setLineWidth) gs.width = a[0];
  else if (fn === OPS.constructPath) {
    // pdf.js 4.x: args = [opsArray, coordsArray, minMax]
    const [pops, coords] = a; let k = 0; const subpaths = []; let cur = null; let closed = false;
    for (const op of pops) {
      if (op === OPS.moveTo) { cur = [apply(gs.ctm, coords[k], coords[k+1])]; subpaths.push(cur); k += 2; }
      else if (op === OPS.lineTo) { cur.push(apply(gs.ctm, coords[k], coords[k+1])); k += 2; }
      else if (op === OPS.curveTo) { cur.push(apply(gs.ctm, coords[k+4], coords[k+5])); k += 6; }   // chord; flatten in a real engine
      else if (op === OPS.curveTo2 || op === OPS.curveTo3) { cur.push(apply(gs.ctm, coords[k+2], coords[k+3])); k += 4; }
      else if (op === OPS.closePath) { closed = true; }
      else if (op === OPS.rectangle) { const [x,y,w,h] = coords.slice(k, k+4); k += 4; subpaths.push([apply(gs.ctm,x,y),apply(gs.ctm,x+w,y),apply(gs.ctm,x+w,y+h),apply(gs.ctm,x,y+h)]); closed = true; }
    }
    pending = { subpaths, closed, width: gs.width, stroke: gs.stroke, fill: gs.fill };
  } else if ([OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke, OPS.endPath].includes(fn)) {
    if (pending) {
      const strokes = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn);
      const fills = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn);
      if (fn !== OPS.endPath) paths.push({ ...pending, closed: pending.closed || [OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn), stroke: strokes ? pending.stroke : null, fill: fills ? pending.fill : null });
      pending = null;
    }
  }
}
const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
const lengthPt = p => p.subpaths.reduce((L, sp) => L + sp.slice(1).reduce((s, pt, j) => s + dist(sp[j], pt), 0) + (p.closed && sp.length > 2 ? dist(sp[sp.length-1], sp[0]) : 0), 0);
const areaPt = p => p.subpaths.reduce((A, sp) => { let s = 0; for (let j = 0; j < sp.length; j++) { const [x1,y1] = sp[j], [x2,y2] = sp[(j+1) % sp.length]; s += x1*y2 - x2*y1; } return A + Math.abs(s) / 2; }, 0);
const bbox = p => { const xs = p.subpaths.flat().map(q => q[0]), ys = p.subpaths.flat().map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const sig = p => JSON.stringify([p.stroke, p.fill, Math.round(p.width * 10) / 10, p.closed]);

// 3. clusters
const clusters = new Map();
for (const p of paths) { const s = sig(p); const c = clusters.get(s) || { n: 0, len: 0, area: 0 }; c.n++; c.len += lengthPt(p) * PT_TO_M; c.area += areaPt(p) * PT_TO_M ** 2; clusters.set(s, c); }

// 4. exclusions: legend box (smallest closed path containing the word LEGEND) and title block (around 'DWG')
const contains = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
const within = (b, inner) => inner[0] >= b[0] && inner[1] >= b[1] && inner[2] <= b[2] && inner[3] <= b[3];
const exclusions = [];
const lg = words.find(w => /^LEGEND/i.test(w.str));
if (lg) { const boxes = paths.filter(p => p.closed && contains(bbox(p), lg.x + 5, lg.y + 3)).sort((a, b) => areaPt(a) - areaPt(b)); if (boxes[0]) exclusions.push(bbox(boxes[0])); }
const tb = words.find(w => /DWG NO/i.test(w.str));
if (tb) exclusions.push([tb.x - 40, 0, 1e9, tb.y + 120]);
const excluded = p => exclusions.some(z => within(z, bbox(p)));

// 5. class map (signature -> item), 6. labels
const CLASS_MAP = {
  [JSON.stringify([[0,0,1], null, 1.5, false])]: ["DR-PIPE", "RC pipe drain", "m"],
  [JSON.stringify([[0,0.55,0], null, 1.5, false])]: ["DR-RCU", "Precast U-drain", "m"],
  [JSON.stringify([[1,0,0], null, 1, true])]: ["DR-SUMP", "Sump / manhole", "no"],
  [JSON.stringify([[0.4,0.4,0.4], [0.75,0.75,0.75], 0.5, true])]: ["RW-ACWC", "Asphalt carriageway", "m2"],
  [JSON.stringify([[0.4,0.4,0.4], [0.9,0.9,0.85], 0.5, true])]: ["RW-FP", "Footpath", "m2"],
};
const labels = words.filter(w => /^D\d+\b/.test(w.str)).map(w => ({ id: w.str.match(/^D\d+/)[0], x: w.x, y: w.y }));
const nearestLabel = p => { const b = bbox(p), cx = (b[0]+b[2])/2, cy = (b[1]+b[3])/2; return labels.map(l => [Math.hypot(l.x-cx, l.y-cy), l.id]).sort((a, b) => a[0]-b[0])[0]?.[1] || ""; };
const byLabel = {}, counts = {}, areas = {};
for (const p of paths) { const cls = CLASS_MAP[sig(p)]; if (!cls || excluded(p)) continue; const [code, , unit] = cls;
  if (unit === "m") byLabel[nearestLabel(p)] = (byLabel[nearestLabel(p)] || 0) + lengthPt(p) * PT_TO_M;
  else if (unit === "no") counts[code] = (counts[code] || 0) + 1; else areas[code] = (areas[code] || 0) + areaPt(p) * PT_TO_M ** 2; }

// 7. scale bar cross-check, 8. compare
const bar = Math.max(0, ...paths.filter(p => p.stroke && p.stroke.join() === "0,0,0" && Math.abs(p.width - 2) < 0.01).map(lengthPt)) * PT_TO_M;
const truth = JSON.parse(fs.readFileSync(file.replace(/\.pdf$/i, ".truth.json"), "utf8"));
console.log(`pdf.js ${pdfjs.version}: ${paths.length} paths, ${words.length} text items; scale 1:${scale}; scale bar ${bar.toFixed(1)} m (expected 100)`);
console.log("signatures:", [...clusters.entries()].map(([s, c]) => `${s} n=${c.n} len=${c.len.toFixed(1)} area=${c.area.toFixed(1)}`).join("\n            "));
let ok = true;
for (const d of truth.drains) { const got = byLabel[d.id] || 0; ok &&= Math.abs(got - d.length_m) < 0.05; console.log(`  ${d.id} ${d.spec.padEnd(18)} measured ${got.toFixed(2).padStart(8)} m  truth ${d.length_m.toFixed(2).padStart(8)}  err ${(got - d.length_m).toFixed(2)}`); }
ok &&= (counts["DR-SUMP"] || 0) === truth.sump_count; console.log(`  sumps counted ${counts["DR-SUMP"] || 0}  truth ${truth.sump_count}`);
for (const [code, key] of [["RW-ACWC", "road_area_m2"], ["RW-FP", "footpath_area_m2"]]) { const got = areas[code] || 0; ok &&= Math.abs(got - truth[key]) < 0.5; console.log(`  ${code.padEnd(8)} measured ${got.toFixed(1).padStart(8)} m2 truth ${truth[key].toFixed(1).padStart(8)}  err ${(got - truth[key]).toFixed(1)}`); }
console.log("RESULT:", ok ? "all quantities match ground truth" : "MISMATCH");
process.exit(ok ? 0 : 1);
