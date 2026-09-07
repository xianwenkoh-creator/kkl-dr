// KKL earthworks engine: spot levels from PDF text, ground surfaces, cut/fill per zone with depth bands, and
// platform excavation (formation platforms with battered sides, berms and stages, as on an ERSS layout plan).
// Pure functions, no DOM, no dependencies. Used by earthworks/index.html (browser) and test/ (node --test).
// Coordinates: page points (PDF user space, y up) are converted to world metres (E,N or scaled page) by a transform.

export const LEVEL_RE = /^(?:RL|FL|SSL|FFL|PL)?[+]?(\d{1,3})\.(\d{2,3})$/i;   // 103.25, +103.250, RL98.500
const EXCLUDE_PREFIX = new Set(["IL", "CH", "H", "E", "N", "DIM", "DEPTH", "D"]);  // invert levels, chainages, heights, coordinates

/** Split text items into word tokens with an estimated x for each token (items may hold several words). */
export function tokenize(items) {
  const out = [];
  items.forEach((it, idx) => {
    const str = it.str || ""; if (!str.trim()) return;
    const parts = str.split(/(\s+)/); let pos = 0; const n = str.length || 1;
    const cos = Math.cos((it.angle || 0) * Math.PI / 180), sin = Math.sin((it.angle || 0) * Math.PI / 180);
    for (const part of parts) {
      if (part.trim()) {
        const off = (it.width || 0) * pos / n;                       // along the baseline
        const clean = part.replace(/[,;:.)\]]+$/, "").replace(/^[(\[]+/, "");   // trailing punctuation in notes: '99.000.' or '98.500,'
        out.push({ str: clean || part, x: it.x + off * cos, y: it.y + off * sin, item: idx, size: it.size || 0, angle: it.angle || 0, y0: it.y, x0: it.x });
      }
      pos += part.length;
    }
  });
  return out;
}

/** Merge a token that is an integer with a following '.dd' token on the same baseline (split levels). */
function mergeSplit(tokens) {
  const out = []; for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], u = tokens[i + 1];
    if (u && /^\d{1,3}$/.test(t.str) && /^\.\d{2,3}$/.test(u.str) && Math.abs(u.y - t.y) < 1.5 && u.x - t.x < 12 * (t.size || 6)) { out.push({ ...t, str: t.str + u.str }); i++; }
    else out.push(t);
  }
  return out;
}

/** Datum-suffixed levels as on ERSS and formation plans: '-12.00m SHD', '+4.0mSHD', '0mSHD', '(-15.50m SHD)'. */
export const DATUM_RE = /^([+-]?\d{1,3}(?:\.\d{1,3})?)m(SHD|MSHD|CD|AMSL|RL|PD|AHD|MSL)?$/i;
const DATUM_WORDS = new Set(["SHD", "MSHD", "CD", "AMSL", "RL", "PD", "AHD", "MSL"]);
/** Classify one token (with the next token for a split datum): {value, decimals, datum} or null. */
export function levelToken(str, next) {
  const m = LEVEL_RE.exec(str);
  if (m) return { value: parseFloat(str.replace(/^(?:RL|FL|SSL|FFL|PL)?\+?/i, "")), decimals: m[2].length, datum: "" };
  const dm = DATUM_RE.exec(str); if (!dm) return null;
  let datum = dm[2] ? dm[2].toUpperCase() : "";
  if (!datum) { if (!(next && DATUM_WORDS.has(String(next).toUpperCase()))) return null; datum = String(next).toUpperCase(); }
  if (datum === "MSHD") datum = "SHD";
  return { value: parseFloat(dm[1]), decimals: (dm[1].split(".")[1] || "").length, datum };
}
/**
 * Spot-level candidates from text items. opts: {min, max, excludePrefixes}
 * Returns [{value, decimals, x, y, raw, prefix, datum, item}] with x,y = token origin on the baseline (page pt).
 * Plain levels need two or three decimals and no excluded prefix; datum-suffixed levels ('-12.00m SHD') are taken as
 * they are, negative values included.
 */
export function parseSpotLevels(items, opts = {}) {
  const min = opts.min ?? -50, max = opts.max ?? 500, excl = new Set(opts.excludePrefixes || [...EXCLUDE_PREFIX]);
  const toks = mergeSplit(tokenize(items)); const out = [];
  toks.forEach((t, i) => {
    const u = toks[i + 1]; const nearNext = u && Math.abs(u.y - t.y) < 1.5 && u.x - t.x < 12 * (t.size || 6) ? u.str : null;
    const lv = levelToken(t.str, nearNext); if (!lv) return;
    if (!(lv.value >= min && lv.value <= max)) return;
    const prev = toks[i - 1]; let prefix = "";
    if (prev && prev.item === t.item && Math.abs(prev.y - t.y) < 1.5 && t.x - prev.x < 40) prefix = prev.str.toUpperCase().replace(/[^A-Z]/g, "");
    if (!lv.datum && prefix && excl.has(prefix)) return;
    out.push({ value: lv.value, decimals: lv.decimals, x: t.x, y: t.y, raw: t.str + (lv.datum && !/m[a-z]+$/i.test(t.str) ? " " + lv.datum : ""), prefix: lv.datum ? "" : prefix, datum: lv.datum, item: t.item, size: t.size });
  });
  return out;
}

/** Level tokens anywhere in free text (design notes): returns [{value, token, datum}] after stripping punctuation. */
export function levelsInText(str) {
  const out = []; const toks = str.split(/\s+/).map(raw => raw.replace(/[,;:.)\]]+$/, "").replace(/^[(\[]+/, ""));
  toks.forEach((t, i) => { const lv = levelToken(t, toks[i + 1]); if (lv) out.push({ value: lv.value, token: t + (lv.datum && !/m[a-z]+$/i.test(t) ? " " + lv.datum : ""), datum: lv.datum }); });
  return out;
}
/** Batter gradients written on the sheet ('1V:2.5H', '1H:2V', '1:1'): [{text, hPerV, count, raw}] most frequent first. */
export function gradientsInText(items) {
  const counts = new Map(); const re = /^(\d+(?:\.\d+)?)([VH])?:(\d+(?:\.\d+)?)([VH])?$/i;
  for (const t of tokenize(items)) {
    const m = re.exec(t.str.replace(/\s+/g, "")); if (!m) continue; const a = +m[1], b = +m[3]; const u1 = (m[2] || "V").toUpperCase(), u2 = (m[4] || "H").toUpperCase(); if (u1 === u2) continue;
    const hPerV = u1 === "V" ? b / a : a / b; if (!(hPerV > 0) || hPerV > 20 || a > 20 || b > 20) continue;   // 1:200 is a scale, not a batter
    const key = `1V:${+hPerV.toFixed(3)}H`; const c = counts.get(key) || { text: key, hPerV, count: 0, raw: new Set() }; c.count++; c.raw.add(m[0]); counts.set(key, c);
  }
  return [...counts.values()].map(c => ({ ...c, raw: [...c.raw] })).sort((a, b) => b.count - a.count);
}

/** Cluster small path centres into markers; markers: [{x,y,w,h}] (page pt). */
export function clusterMarkers(cands, tol = 2.0) {
  const out = [];
  for (const c of cands) {
    const m = out.find(o => Math.abs(o.x - c.x) <= tol && Math.abs(o.y - c.y) <= tol);
    if (m) { m.x = (m.x * m.n + c.x) / (m.n + 1); m.y = (m.y * m.n + c.y) / (m.n + 1); m.n++; }
    else out.push({ x: c.x, y: c.y, n: 1 });
  }
  return out;
}

/**
 * Attach each level label to the nearest marker within radius (page pt); one marker per label.
 * Returns levels with px,py (the point the level applies to) and source 'marker' | 'text'.
 */
export function associateMarkers(levels, markers, opts = {}) {
  const radius = opts.radius ?? 14, taken = new Set();
  const pairs = [];
  levels.forEach((l, li) => markers.forEach((m, mi) => {
    const dx = m.x - l.x, dy = m.y - l.y;                          // marker relative to label origin
    const d = Math.hypot(dx, dy); if (d <= radius) pairs.push({ d, li, mi });
  }));
  pairs.sort((a, b) => a.d - b.d);
  const assigned = new Map();
  for (const p of pairs) { if (assigned.has(p.li) || taken.has(p.mi)) continue; assigned.set(p.li, p.mi); taken.add(p.mi); }
  return levels.map((l, li) => {
    const mi = assigned.get(li);
    if (mi !== undefined) return { ...l, px: markers[mi].x, py: markers[mi].y, source: "marker" };
    return { ...l, px: l.x - 1.0, py: l.y - 0.5, source: "text" };  // fallback: the label origin itself
  });
}

// ---------------- scale and georeference ----------------
export const M_PER_PT_AT_1 = 25.4 / 72 / 1000;                    // metres per point at 1:1
export function scaleFromDeclared(scale) { return M_PER_PT_AT_1 * scale; }
export function calibrateTwoPoints(p1, p2, metres) { return metres / Math.hypot(p2.x - p1.x, p2.y - p1.y); }
/** Read 'SCALE 1:500' style text; ignores gradients like 1:12 by requiring >= 50. */
export function declaredScaleFromText(items) {
  const txt = items.map(i => i.str).join(" ");
  const m = /SCALE\s*[:\-]?\s*1\s*:\s*(\d{2,5})/i.exec(txt); if (m && +m[1] >= 50) return +m[1];
  return null;
}
/**
 * Georeference from grid labels: tokens 'E 21000' / 'N 31000' (or E21000). Fits E = a*x + b (from E labels'
 * x) and N = c*y + d (from N labels' y). Optional lines [{x1,y1,x2,y2}] snap labels to the nearest long line.
 * Returns {ok, mPerPt, toWorld(x,y)->{X,Y}, fromWorld(X,Y)->{x,y}, eLabels, nLabels} or {ok:false}.
 */
export function georeferenceFromGrid(items, lines = []) {
  const toks = tokenize(items); const E = [], N = [];
  const re = /^([EN])\s?(\d{4,7}(?:\.\d+)?)$/;
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i], m = re.exec(t.str.replace(/\s+/g, ""));
    if (!m && /^[EN]$/.test(t.str) && toks[i + 1] && /^\d{4,7}(\.\d+)?$/.test(toks[i + 1].str) && toks[i + 1].item === t.item) { m = [null, t.str, toks[i + 1].str]; }
    if (!m) continue;
    const val = parseFloat(m[2]);
    if (m[1] === "E") { let x = t.x; const ln = nearestLine(lines, "v", x, t.y); if (ln) x = ln; E.push({ x, val }); }
    else { let y = t.y; const ln = nearestLine(lines, "h", y, t.x); if (ln) y = ln; N.push({ y, val }); }
  }
  const fe = fitLine(E.map(p => [p.x, p.val])), fn = fitLine(N.map(p => [p.y, p.val]));
  if (!fe || !fn) return { ok: false, eLabels: E, nLabels: N };
  const mPerPt = (Math.abs(fe.a) + Math.abs(fn.a)) / 2;
  if (Math.abs(Math.abs(fe.a) - Math.abs(fn.a)) / mPerPt > 0.03) return { ok: false, eLabels: E, nLabels: N, reason: "E and N scales differ" };
  return { ok: true, mPerPt, eLabels: E, nLabels: N,
    toWorld: (x, y) => ({ X: fe.a * x + fe.b, Y: fn.a * y + fn.b }), fromWorld: (X, Y) => ({ x: (X - fe.b) / fe.a, y: (Y - fn.b) / fn.a }) };
}
function nearestLine(lines, kind, coord, other) {
  let best = null, bd = 6;
  for (const l of lines) {
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); if (len < 150) continue;
    if (kind === "v" && Math.abs(l.x2 - l.x1) < 1 && Math.abs(l.x1 - coord) < bd) { bd = Math.abs(l.x1 - coord); best = l.x1; }
    if (kind === "h" && Math.abs(l.y2 - l.y1) < 1 && Math.abs(l.y1 - coord) < bd) { bd = Math.abs(l.y1 - coord); best = l.y1; }
  }
  return best;
}
function fitLine(pairs) {                                        // least squares y = a x + b
  if (pairs.length < 2) return null; const n = pairs.length;
  const sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const den = n * sxx - sx * sx; if (Math.abs(den) < 1e-9) return null;
  const a = (n * sxy - sx * sy) / den; return { a, b: (sy - a * sx) / n };
}
/** Plain scaled transform when no grid: world = (page pt) * mPerPt, origin at page (0,0). */
export function scaledTransform(mPerPt) { return { mPerPt, toWorld: (x, y) => ({ X: x * mPerPt, Y: y * mPerPt }), fromWorld: (X, Y) => ({ x: X / mPerPt, y: Y / mPerPt }) }; }

// ---------------- surfaces ----------------
/** QS proximity method: average of the k nearest levels within radius (metres). */
export function proximity(points, { k = 4, radius = 30 } = {}) {
  return (X, Y) => { const near = kNearest(points, X, Y, k, radius); if (!near.length) return null; return near.reduce((s, p) => s + p.z, 0) / near.length; };
}
/** Inverse-distance weighting over the k nearest within radius. */
export function idw(points, { k = 6, radius = 40, power = 2 } = {}) {
  return (X, Y) => { const near = kNearest(points, X, Y, k, radius); if (!near.length) return null;
    let ws = 0, zs = 0; for (const p of near) { const d = Math.max(p.d, 1e-6); if (d < 1e-3) return p.z; const w = 1 / d ** power; ws += w; zs += w * p.z; } return zs / ws; };
}
function kNearest(points, X, Y, k, radius) {
  const r2 = radius * radius, cand = [];
  for (const p of points) { const d2 = (p.X - X) ** 2 + (p.Y - Y) ** 2; if (d2 <= r2) cand.push({ z: p.z, d: Math.sqrt(d2) }); }
  cand.sort((a, b) => a.d - b.d); return cand.slice(0, k);
}
/** Delaunay triangulation (Bowyer-Watson). points: [{X,Y,z}]. Returns triangles as index triples. */
export function delaunay(points) {
  const n = points.length; if (n < 3) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.X); maxX = Math.max(maxX, p.X); minY = Math.min(minY, p.Y); maxY = Math.max(maxY, p.Y); }
  const dm = Math.max(maxX - minX, maxY - minY) * 20 + 10, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const P = points.map(p => [p.X, p.Y]).concat([[mx - dm, my - dm], [mx, my + dm], [mx + dm, my - dm]]);
  const circ = (a, b, c) => { const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c]; const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)); if (Math.abs(d) < 1e-12) return null;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d, uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { a, b, c, ux, uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 }; };
  let tris = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i]; const bad = [], keep = [];
    for (const t of tris) (((px - t.ux) ** 2 + (py - t.uy) ** 2) < t.r2 ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) for (const [a, b] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) { const key = a < b ? a * 1e6 + b : b * 1e6 + a; edges.set(key, (edges.get(key) || 0) + 1); }
    tris = keep;
    for (const [key, cnt] of edges) if (cnt === 1) { const a = Math.floor(key / 1e6), b = key % 1e6; const t = circ(a, b, i); if (t) tris.push(t); }
  }
  return tris.filter(t => t.a < n && t.b < n && t.c < n).map(t => [t.a, t.b, t.c]);
}
/** TIN surface with linear interpolation inside the hull and proximity fallback outside. */
export function tin(points, fallback = proximity(points, { k: 3, radius: 60 })) {
  const tris = delaunay(points); const cells = new Map(); const CS = 20;   // coarse index of triangles by bbox
  tris.forEach((t, i) => { const xs = t.map(v => points[v].X), ys = t.map(v => points[v].Y);
    for (let cx = Math.floor(Math.min(...xs) / CS); cx <= Math.floor(Math.max(...xs) / CS); cx++) for (let cy = Math.floor(Math.min(...ys) / CS); cy <= Math.floor(Math.max(...ys) / CS); cy++) { const k = cx + "," + cy; (cells.get(k) || cells.set(k, []).get(k)).push(i); } });
  const f = (X, Y) => {
    const list = cells.get(Math.floor(X / CS) + "," + Math.floor(Y / CS)) || [];
    for (const i of list) { const [a, b, c] = tris[i]; const A = points[a], B = points[b], C = points[c];
      const det = (B.Y - C.Y) * (A.X - C.X) + (C.X - B.X) * (A.Y - C.Y); if (Math.abs(det) < 1e-12) continue;
      const l1 = ((B.Y - C.Y) * (X - C.X) + (C.X - B.X) * (Y - C.Y)) / det, l2 = ((C.Y - A.Y) * (X - C.X) + (A.X - C.X) * (Y - C.Y)) / det, l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * A.z + l2 * B.z + l3 * C.z; }
    return fallback(X, Y);
  };
  f.triangles = tris; return f;
}

// ---------------- polygons and volumes ----------------
export function polygonArea(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.X * b.Y - b.X * a.Y; } return Math.abs(s) / 2; }
export function pointInPolygon(X, Y, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.Y > Y) !== (b.Y > Y) && X < (b.X - a.X) * (Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside; } return inside; }
export const DR_BANDS = [1.5, 3, 6], CONTRACT_BANDS = [2, 4, 6];
export function bandNames(edges) { const n = [`<${edges[0]}`]; for (let i = 1; i < edges.length; i++) n.push(`${edges[i - 1]}-${edges[i]}`); n.push(`>${edges[edges.length - 1]}`); return n; }
const fmtLevel = v => (v >= 0 ? "+" : "") + v.toFixed(2);
/** Names of the absolute-level bands for cut-off levels sorted high to low: 'above +4.00', '-6.00 to +4.00', 'below -6.00'. */
export function levelBandNames(cuts) { if (!cuts.length) return []; const n = [`above ${fmtLevel(cuts[0])}`]; for (let i = 1; i < cuts.length; i++) n.push(`${fmtLevel(cuts[i])} to ${fmtLevel(cuts[i - 1])}`); n.push(`below ${fmtLevel(cuts[cuts.length - 1])}`); return n; }
/**
 * Grid method over a polygon (world metres). egl: surface fn (X,Y)->level|null. fel: number, fn (X,Y)->level, or a
 * design surface with fel.at(X,Y)->{z, tag} (tag = the platform governing that cell).
 * opts: {cell=1, bands=DR_BANDS, sample:'corners'|'centre', levels:[absolute cut-off levels for stage volumes]}
 * Returns {cells:[{X,Y,egl,fel,depth,area,tag}], summary:{area,cut,fill,avgCutDepth,maxDepth,byLayer,byMaxDepth,byLevel,byTag:{tag:{area,cut,fill,byLayer,byLevel}},missing}}
 */
export function gridVolumes(poly, egl, fel, opts = {}) {
  const cell = opts.cell ?? 1, edges = opts.bands ?? DR_BANDS, sample = opts.sample ?? "corners", names = bandNames(edges);
  const felAt = typeof fel === "function" ? (typeof fel.at === "function" ? fel.at : (X, Y) => ({ z: fel(X, Y) })) : () => ({ z: fel });
  const cuts = (opts.levels || []).slice().sort((a, b) => b - a), lvNames = levelBandNames(cuts), bounds = [Infinity, ...cuts, -Infinity];
  const xs = poly.map(p => p.X), ys = poly.map(p => p.Y); const x0 = Math.floor(Math.min(...xs) / cell) * cell, x1 = Math.max(...xs), y0 = Math.floor(Math.min(...ys) / cell) * cell, y1 = Math.max(...ys);
  const cells = []; let area = 0, cut = 0, fill = 0, missing = 0, maxDepth = 0; const byLayer = Object.fromEntries(names.map(n => [n, 0])), byMax = Object.fromEntries(names.map(n => [n, 0])), byLevel = Object.fromEntries(lvNames.map(n => [n, 0])), byTag = {};
  const a = cell * cell, e = [0, ...edges, Infinity];
  for (let X = x0 + cell / 2; X < x1; X += cell) for (let Y = y0 + cell / 2; Y < y1; Y += cell) {
    if (!pointInPolygon(X, Y, poly)) continue;
    let g;
    if (sample === "corners") { const vs = [egl(X - cell / 2, Y - cell / 2), egl(X + cell / 2, Y - cell / 2), egl(X + cell / 2, Y + cell / 2), egl(X - cell / 2, Y + cell / 2)].filter(v => v != null); g = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null; }
    else g = egl(X, Y);
    const r = felAt(X, Y); const f = r.z, tag = r.tag; area += a;
    const bt = tag != null ? (byTag[tag] || (byTag[tag] = { area: 0, cut: 0, fill: 0, byLayer: Object.fromEntries(names.map(n => [n, 0])), byLevel: Object.fromEntries(lvNames.map(n => [n, 0])) })) : null; if (bt) bt.area += a;
    if (g == null || f == null || !isFinite(f)) { missing += a; cells.push({ X, Y, egl: g, fel: isFinite(f) ? f : null, depth: null, area: a, tag }); continue; }
    const d = g - f; cells.push({ X, Y, egl: g, fel: f, depth: d, area: a, tag });
    if (d > 0) { cut += d * a; maxDepth = Math.max(maxDepth, d); if (bt) bt.cut += d * a;
      for (let k = 0; k < names.length; k++) { const v = Math.max(0, Math.min(d, e[k + 1]) - e[k]) * a; byLayer[names[k]] += v; if (bt) bt.byLayer[names[k]] += v; }
      byMax[names[edges.filter(b => d >= b).length]] += d * a;
      for (let k = 0; k < lvNames.length; k++) { const v = Math.max(0, Math.min(g, bounds[k]) - Math.max(f, bounds[k + 1])) * a; byLevel[lvNames[k]] += v; if (bt) bt.byLevel[lvNames[k]] += v; } }
    else { fill += -d * a; if (bt) bt.fill += -d * a; }
  }
  const cutArea = cells.filter(c => c.depth > 0).reduce((s, c) => s + c.area, 0);
  return { cells, summary: { area, cut, fill, avgCutDepth: cutArea ? cut / cutArea : 0, maxDepth, byLayer, byMaxDepth: byMax, byLevel, byTag, missing, cell, bands: names, levelBands: lvNames } };
}
/** Approximate extra excavation for battered sides: sum over edges of (depth along edge)^2 * slopeH / 2 * length. slopeH = horizontal per 1 vertical. */
export function batterAllowance(poly, egl, fel, slopeH = 1, step = 1) {
  let vol = 0; const felFn = typeof fel === "function" ? fel : () => fel;
  for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length]; const L = Math.hypot(B.X - A.X, B.Y - A.Y); const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, X = A.X + (B.X - A.X) * t, Y = A.Y + (B.Y - A.Y) * t; const g = egl(X, Y), f = felFn(X, Y); if (g == null || f == null) continue; const d = Math.max(0, g - f); vol += d * d * slopeH / 2 * (L / n); } }
  return vol;
}

// ---------------- platform excavation: formation platforms with battered sides (ERSS layout plans) ----------------
/** Existing ground as one level everywhere (a pre-cut platform, reclaimed land at a stated level). */
export function flatSurface(level) { const f = () => level; f.level = level; return f; }
/** Edge geometry, outward normals, convex corners and bbox for a polygon [{X,Y}] (either orientation). */
export function preparePolygon(poly) {
  const n = poly.length; let area2 = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area2 += a.X * b.Y - b.X * a.Y; }
  const ccw = area2 > 0; const edges = [];
  for (let i = 0; i < n; i++) { const A = poly[i], B = poly[(i + 1) % n]; const dx = B.X - A.X, dy = B.Y - A.Y, L = Math.hypot(dx, dy) || 1e-9; edges.push({ A, B, dx, dy, L, nx: ccw ? dy / L : -dy / L, ny: ccw ? -dx / L : dx / L }); }
  const convex = poly.map((V, i) => { const P = poly[(i - 1 + n) % n], N = poly[(i + 1) % n]; const cr = (V.X - P.X) * (N.Y - V.Y) - (V.Y - P.Y) * (N.X - V.X); return ccw ? cr > 1e-9 : cr < -1e-9; });
  const xs = poly.map(p => p.X), ys = poly.map(p => p.Y);
  return { poly, edges, convex, bbox: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }, area: Math.abs(area2) / 2 };
}
/**
 * Horizontal offset from the platform edge to (X,Y): 0 inside. corners 'mitred' = planar batter faces meeting at
 * outside corners (the QS and CAD convention, larger top-of-slope outline); 'rounded' = true distance (conical corners).
 * The mitre is limited to twice the true distance at sharp corners. Also returns the closest point on the edge.
 */
export function offsetDistance(prep, X, Y, corners = "mitred") {
  if (pointInPolygon(X, Y, prep.poly)) return { d: 0, qx: X, qy: Y, inside: true };
  let best = Infinity, qx = X, qy = Y, bi = -1, bt = 0;
  prep.edges.forEach((e, i) => { const t = Math.max(0, Math.min(1, ((X - e.A.X) * e.dx + (Y - e.A.Y) * e.dy) / (e.L * e.L))); const px = e.A.X + e.dx * t, py = e.A.Y + e.dy * t; const d = Math.hypot(X - px, Y - py); if (d < best) { best = d; qx = px; qy = py; bi = i; bt = t; } });
  let d = best;
  if (corners === "mitred" && (bt <= 1e-9 || bt >= 1 - 1e-9)) {
    const n = prep.edges.length, vi = bt <= 1e-9 ? bi : (bi + 1) % n;                       // edge i starts at vertex i
    if (prep.convex[vi]) { const e1 = prep.edges[(vi - 1 + n) % n], e2 = prep.edges[vi];
      const d1 = (X - e1.A.X) * e1.nx + (Y - e1.A.Y) * e1.ny, d2 = (X - e2.A.X) * e2.nx + (Y - e2.A.Y) * e2.ny;
      if (d1 >= -1e-9 && d2 >= -1e-9) d = Math.max(Math.max(d1, d2), best / 2); }
  }
  return { d, qx, qy, inside: false };
}
/**
 * Slope rules by level band as read off the sections. bands: [{top, H}] with H = horizontal per 1 vertical (0 =
 * vertical), each applying from the band below up to 'top', the last one above its top too; berms: [{level, width}]
 * flat benches met while rising. rise(fel, d) = level reached d metres out from a platform at fel;
 * reach(fel, top) = horizontal offset needed to rise from fel to top.
 */
export function slopeRules(bands = [{ top: Infinity, H: 1 }], berms = []) {
  const B = bands.slice().sort((a, b) => a.top - b.top); if (!B.length || isFinite(B[B.length - 1].top)) B.push({ top: Infinity, H: B.length ? B[B.length - 1].H : 1 });
  const M = berms.slice().sort((a, b) => a.level - b.level);
  const Hat = z => { for (const b of B) if (z < b.top - 1e-9) return b.H; return B[B.length - 1].H; };
  const events = fel => [...new Set([...B.map(b => b.top), ...M.map(m => m.level)])].filter(L => isFinite(L) && L > fel + 1e-9).sort((a, b) => a - b);
  function rise(fel, d) {
    let z = fel, rem = d;
    for (const L of events(fel)) {
      const H = Hat(z);
      if (H > 0) { const need = H * (L - z); if (rem <= need) return z + rem / H; rem -= need; }
      z = L; const berm = M.find(m => Math.abs(m.level - L) < 1e-9); if (berm) { if (rem <= berm.width) return L; rem -= berm.width; }
    }
    const H = Hat(z); return H > 0 ? z + rem / H : (rem <= 0 ? z : Infinity);
  }
  function reach(fel, top) {
    let z = fel, d = 0;
    for (const L of events(fel)) { if (L >= top) break; d += Hat(z) * (L - z); z = L; const berm = M.find(m => Math.abs(m.level - L) < 1e-9); if (berm) d += berm.width; }
    if (top > z) { const H = Hat(z); d += H > 0 ? H * (top - z) : 0; }
    return d;
  }
  return { rise, reach, bands: B, berms: M };
}
/** '1V:1H to -6, 1:2.5 to +4, vertical' -> bands [{top:-6,H:1},{top:4,H:2.5},{top:Infinity,H:0}]; null if nothing parses. */
export function parseSlopeText(s) {
  const bands = [];
  for (const part of String(s || "").split(/[,;\n]+/)) {
    const m = /^\s*(?:(vertical|wall)|(\d+(?:\.\d+)?)\s*([VH])?\s*:\s*(\d+(?:\.\d+)?)\s*([VH])?)\s*(?:(?:to|up\s*to|below|<)\s*([+-]?\d+(?:\.\d+)?)\s*(?:m\s*SHD|mSHD|m)?)?\s*$/i.exec(part); if (!m) continue;
    let H = 0; if (!m[1]) { const a = +m[2], b = +m[4], u1 = (m[3] || "V").toUpperCase(); H = u1 === "V" ? b / a : a / b; }
    bands.push({ H: +H.toFixed(4), top: m[6] != null ? +m[6] : Infinity });
  }
  return bands.length ? bands : null;
}
/** '3 @ -12, 3m at -6' -> berms [{width:3, level:-12}, ...]. */
export function parseBermText(s) {
  const out = []; for (const part of String(s || "").split(/[,;\n]+/)) { const m = /^\s*(\d+(?:\.\d+)?)\s*m?\s*(?:@|at)\s*([+-]?\d+(?:\.\d+)?)\s*(?:m\s*SHD|mSHD|m)?\s*$/i.exec(part); if (m) out.push({ width: +m[1], level: +m[2] }); } return out;
}
export function formatRules(rules) { const b = rules.bands.map(x => (x.H > 0 ? `1V:${+x.H.toFixed(3)}H` : "vertical") + (isFinite(x.top) ? ` to ${fmtLevel(x.top)}` : " above")).join("; "); const m = rules.berms.map(x => `${x.width} m @ ${fmtLevel(x.level)}`).join(", "); return b + (m ? ` | berms ${m}` : ""); }
/** Level on a graded platform (ramp): linear between p1 at z1 and p2 at z2 along the p1-p2 axis, flat beyond the ends. */
export function gradedLevel(g) { const dx = g.p2.X - g.p1.X, dy = g.p2.Y - g.p1.Y, L2 = dx * dx + dy * dy || 1e-9; return (X, Y) => { const t = Math.max(0, Math.min(1, ((X - g.p1.X) * dx + (Y - g.p1.Y) * dy) / L2)); return g.z1 + (g.z2 - g.z1) * t; }; }
/**
 * Excavation design surface: the lowest level any platform, or the batter rising from its edge under the slope rules,
 * reaches at (X,Y), capped by the existing ground. platforms: [{name, poly:[{X,Y}], fel: number | {p1,z1,p2,z2},
 * sides:'rules'|'vertical'}]. opts: {corners:'mitred'|'rounded', top: highest existing level (for pruning)}.
 * Returns f(X,Y)->level|null with f.at(X,Y)->{z, tag, index, inside} (tag = platform name, or name + ' slopes').
 */
export function designSurface(platforms, rules, egl, opts = {}) {
  const corners = opts.corners ?? "mitred", top = opts.top ?? 200;
  const P = platforms.map(p => { const prep = preparePolygon(p.poly); const graded = typeof p.fel !== "number";
    const felFn = graded ? gradedLevel(p.fel) : () => p.fel; const felMin = graded ? Math.min(p.fel.z1, p.fel.z2) : p.fel;
    return { ...p, prep, felFn, reach: p.sides === "vertical" ? 0 : rules.reach(felMin, top) }; });
  function envelope(X, Y) {
    let best = Infinity, gi = -1, gin = false;
    for (let i = 0; i < P.length; i++) { const p = P[i], b = p.prep.bbox; if (X < b.x0 - p.reach || X > b.x1 + p.reach || Y < b.y0 - p.reach || Y > b.y1 + p.reach) continue;
      const o = offsetDistance(p.prep, X, Y, corners); let z;
      if (o.inside) z = p.felFn(X, Y); else if (p.sides === "vertical") continue; else z = rules.rise(p.felFn(o.qx, o.qy), o.d);
      if (z < best) { best = z; gi = i; gin = o.inside; } }
    return { z: best, index: gi, inside: gin };
  }
  const f = (X, Y) => { const g = egl(X, Y); if (g == null) return null; return Math.min(g, envelope(X, Y).z); };
  f.at = (X, Y) => { const g = egl(X, Y); const e = envelope(X, Y); if (g == null) return { z: null, tag: null, index: e.index, inside: e.inside };
    const z = Math.min(g, e.z); const tag = e.index < 0 || z >= g ? null : e.inside ? P[e.index].name : P[e.index].name + " slopes"; return { z, tag, index: e.index, inside: e.inside }; };
  f.envelope = (X, Y) => envelope(X, Y).z; f.platforms = P; f.rules = rules; f.corners = corners;
  return f;
}
export function toCSV(rows, cols) { const esc = v => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\r\n"); }
export const fmt = (v, d = 1) => v == null ? "" : Number(v).toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });
