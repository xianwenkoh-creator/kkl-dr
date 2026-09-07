// Minimal ASCII DXF reader for excavation layout drawings: layers, polylines, lines, circles and text with block
// inserts expanded (translate, scale, rotate). Pure functions, no dependencies; shared by the app and the tests.
// Coordinates come back in drawing units (metres on Singapore civil drawings; see unitsGuess for millimetre files).

/** Parse the group-code pairs of an ASCII DXF string into [{code, value}]. */
export function dxfPairs(text) {
  const lines = text.split(/\r\n|\r|\n/); const out = [];
  for (let i = 0; i + 1 < lines.length; i += 2) { const code = parseInt(lines[i].trim(), 10); if (Number.isNaN(code)) { i--; continue; } out.push({ code, value: lines[i + 1].replace(/\r$/, "") }); }
  return out;
}
/** Strip MTEXT formatting: \P paragraphs, {\f...;} fonts, \H, \W, \Q, \C, \A codes, %%d %%p %%c, stacked fractions. */
export function cleanMtext(s) {
  return String(s || "").replace(/\\P/g, " ").replace(/\\~/g, " ").replace(/\\S([^;^#/]*)[\^#/]([^;]*);/g, "$1/$2").replace(/\\[ACFHQTWfhpq][^;]*;/g, "").replace(/\\[LlOoKk]/g, "").replace(/[{}]/g, "").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±").replace(/%%[cC]/g, "Ø").replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\s+/g, " ").trim();
}
const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
/** Read one entity's pairs (from index i, whose pair is {code:0, value:type}) into a plain object; returns [entity, nextIndex]. */
function readEntity(pairs, i) {
  const e = { type: pairs[i].value, layer: "0", pts: [], text: "", chunks: [] }; i++;
  for (; i < pairs.length && pairs[i].code !== 0; i++) {
    const { code, value } = pairs[i]; const v = parseFloat(value);
    switch (code) {
      case 8: e.layer = value.trim(); break;
      case 2: e.name = value.trim(); break;
      case 1: e.text = value; break;
      case 3: e.chunks.push(value); break;
      case 10: e.pts.push([v, 0]); break;
      case 20: if (e.pts.length) e.pts[e.pts.length - 1][1] = v; break;
      case 11: e.x2 = v; break; case 21: e.y2 = v; break;
      case 40: e.r = v; break; case 41: e.sx = v; break; case 42: if (e.type === "INSERT") e.sy = v; else e.bulge = v; break;
      case 50: e.rot = v; break; case 51: e.rot2 = v; break;
      case 70: e.flags = parseInt(value, 10); break; case 71: e.attach = parseInt(value, 10); break; case 72: e.halign = parseInt(value, 10); break; case 73: e.valign = parseInt(value, 10); break;
      case 90: e.n = parseInt(value, 10); break;
      default: break;
    }
  }
  return [e, i];
}
/**
 * Parse an ASCII DXF. Returns {layers:{name:{polylines,lines,texts,circles}}, polylines:[{layer,pts,closed,area,bbox}],
 * lines:[{layer,x1,y1,x2,y2}], texts:[{layer,x,y,text,height,rot}], circles:[{layer,x,y,r}], extents:{x0,y0,x1,y1}, unitsGuess}.
 * Block INSERTs are expanded one level deep with translate/scale/rotate; XREFs and hatches are ignored.
 */
export function parseDxf(text) {
  const pairs = dxfPairs(text); const blocks = new Map(); const ents = [];
  let section = ""; let i = 0;
  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value === "SECTION") { section = pairs[i + 1] && pairs[i + 1].code === 2 ? pairs[i + 1].value.trim() : ""; i += 2; continue; }
    if (p.code === 0 && p.value === "ENDSEC") { section = ""; i++; continue; }
    if (section === "BLOCKS" && p.code === 0 && p.value === "BLOCK") {
      const [hdr, j] = readEntity(pairs, i); const block = { name: hdr.name || "", base: hdr.pts[0] || [0, 0], ents: [] }; i = j;
      while (i < pairs.length && !(pairs[i].code === 0 && pairs[i].value === "ENDBLK")) { const [e, k] = readEntity(pairs, i); block.ents.push(e); i = k; }
      blocks.set(block.name, block); continue;
    }
    if (section === "ENTITIES" && p.code === 0) { const [e, j] = readEntity(pairs, i); ents.push(e); i = j; continue; }
    i++;
  }
  const out = { layers: {}, polylines: [], lines: [], texts: [], circles: [] };
  const layer = name => out.layers[name] || (out.layers[name] = { polylines: 0, lines: 0, texts: 0, circles: 0 });
  const emit = (e, tf) => {                                     // tf: point transform for inserts (identity at top level)
    const T = tf || (q => q);
    if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
      const pts = e.pts.map(T); if (pts.length < 2) return; const closed = !!(e.flags & 1) || (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6);
      if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
      let a2 = 0; for (let k = 0; k < pts.length; k++) { const p1 = pts[k], p2 = pts[(k + 1) % pts.length]; a2 += p1[0] * p2[1] - p2[0] * p1[1]; }
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      out.polylines.push({ layer: e.layer, pts, closed, area: closed ? Math.abs(a2) / 2 : 0, bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } }); layer(e.layer).polylines++;
    } else if (e.type === "LINE") { if (!e.pts.length) return; const a = T(e.pts[0]), b = T([e.x2 ?? e.pts[0][0], e.y2 ?? e.pts[0][1]]); out.lines.push({ layer: e.layer, x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); layer(e.layer).lines++; }
    else if (e.type === "TEXT" || e.type === "MTEXT" || e.type === "ATTRIB") {
      if (!e.pts.length) return; const raw = e.type === "MTEXT" ? e.chunks.join("") + e.text : e.text; const str = cleanMtext(raw); if (!str) return;
      const useAlign = e.type === "TEXT" && ((e.halign || 0) !== 0 || (e.valign || 0) !== 0) && e.x2 != null; const p = T(useAlign ? [e.x2, e.y2] : e.pts[0]);
      out.texts.push({ layer: e.layer, x: p[0], y: p[1], text: str, height: e.r || 0, rot: e.rot || 0 }); layer(e.layer).texts++;
    } else if (e.type === "CIRCLE") { if (!e.pts.length) return; const p = T(e.pts[0]); out.circles.push({ layer: e.layer, x: p[0], y: p[1], r: e.r || 0 }); layer(e.layer).circles++; }
  };
  const expandInsert = (ins, depth) => {
    const b = blocks.get(ins.name); if (!b || depth > 2 || !ins.pts.length) return;
    const sx = ins.sx ?? 1, sy = ins.sy ?? sx, a = (ins.rot || 0) * Math.PI / 180, [ix, iy] = ins.pts[0], [bx, by] = b.base;
    const tf = q => { const [x, y] = rot((q[0] - bx) * sx, (q[1] - by) * sy, a); return [x + ix, y + iy]; };
    for (const e of b.ents) { if (e.type === "INSERT") { const sub = { ...e, pts: e.pts.map(tf), rot: (e.rot || 0) + (ins.rot || 0), sx: (e.sx ?? 1) * sx, sy: (e.sy ?? e.sx ?? 1) * sy }; expandInsert(sub, depth + 1); } else emit(e, tf); }
  };
  let pendingPoly = null;
  for (const e of ents) {
    if (e.type === "POLYLINE") { pendingPoly = { ...e, pts: [] }; continue; }
    if (e.type === "VERTEX" && pendingPoly) { if (e.pts.length) pendingPoly.pts.push(e.pts[0]); continue; }
    if (e.type === "SEQEND" && pendingPoly) { emit(pendingPoly); pendingPoly = null; continue; }
    if (e.type === "INSERT") { expandInsert(e, 0); continue; }
    emit(e);
  }
  const xs = [], ys = []; for (const p of out.polylines) { xs.push(p.bbox.x0, p.bbox.x1); ys.push(p.bbox.y0, p.bbox.y1); } for (const l of out.lines) { xs.push(l.x1, l.x2); ys.push(l.y1, l.y2); } for (const t of out.texts) { xs.push(t.x); ys.push(t.y); }
  out.extents = xs.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : { x0: 0, y0: 0, x1: 1, y1: 1 };
  const span = Math.max(out.extents.x1 - out.extents.x0, out.extents.y1 - out.extents.y0); out.unitsGuess = span > 50000 ? "mm" : "m";
  return out;
}
/**
 * Candidate platforms from closed polygons (DXF polylines on chosen layers, or PDF paths in one pen), each given the
 * level label written inside it: the smallest enclosing polygon owns a label, so a sump inside a platform keeps its
 * own level; two different levels inside one polygon mark a ramp. polys: [{pts:[[x,y]], closed, area, bbox, layer?}];
 * levelTexts: [{x, y, value, raw}] in the same coordinates. Returns [{name, layer, pts:[{X,Y}], area, fel, label,
 * labels, ambiguous}] largest first.
 */
export function platformsFromPolys(polys, levelTexts, opts = {}) {
  const minArea = opts.minArea ?? 4;
  const P = polys.filter(p => p.closed && p.pts.length > 2 && p.area >= minArea).map(p => ({ layer: p.layer || "", pts: p.pts.map(([X, Y]) => ({ X, Y })), area: p.area, bbox: p.bbox, labels: [] }));
  const inside = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.Y > y) !== (b.Y > y) && x < (b.X - a.X) * (y - a.Y) / (b.Y - a.Y) + a.X) c = !c; } return c; };
  for (const t of levelTexts) { let best = null; for (const p of P) { if (t.x < p.bbox.x0 || t.x > p.bbox.x1 || t.y < p.bbox.y0 || t.y > p.bbox.y1) continue; if (inside(t.x, t.y, p.pts) && (!best || p.area < best.area)) best = p; } if (best) best.labels.push(t); }
  P.sort((a, b) => b.area - a.area);
  return P.map((p, i) => { const vals = [...new Set(p.labels.map(l => l.value))]; return { name: opts.namePrefix ? `${opts.namePrefix} ${i + 1}` : `P${i + 1}`, layer: p.layer, pts: p.pts, area: p.area, fel: vals.length === 1 ? vals[0] : null, label: p.labels.length ? p.labels.map(l => l.raw).join(" | ") : "", labels: p.labels, ambiguous: vals.length > 1 }; });
}
/** DXF: closed polylines on the chosen layers to platforms (see platformsFromPolys). */
export function platformsFromDxf(dxf, layers, levelTexts, opts = {}) { const set = new Set(layers); return platformsFromPolys(dxf.polylines.filter(p => set.has(p.layer)), levelTexts, opts); }
/** Level labels among the DXF texts, using the engine's level parser (levelsInText): [{x,y,value,raw,datum,layer,text}]. */
export function levelTextsFromDxf(dxf, levelsInText, opts = {}) {
  const out = []; const datumOnly = opts.datumOnly ?? true;
  for (const t of dxf.texts) for (const lv of levelsInText(t.text)) { if (datumOnly && !lv.datum) continue; out.push({ x: t.x, y: t.y, value: lv.value, raw: lv.token, datum: lv.datum, layer: t.layer, text: t.text }); }
  return out;
}
