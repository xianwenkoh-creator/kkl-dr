// KKL earthworks engine: spot levels from PDF text, ground surfaces, cut/fill per zone with depth bands.
// Pure functions, no DOM, no dependencies. Used by earthworks/index.html (browser) and test/ (node --test).
// Coordinates: page points (PDF user space, y up) are converted to world metres (E,N or scaled page) by a transform.

export const LEVEL_RE = /^[+]?(\d{1,3})\.(\d{2,3})$/;                 // 103.25, +103.250
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
        out.push({ str: part, x: it.x + off * cos, y: it.y + off * sin, item: idx, size: it.size || 0, angle: it.angle || 0, y0: it.y, x0: it.x });
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

/**
 * Spot-level candidates from text items. opts: {min, max, excludePrefixes}
 * Returns [{value, decimals, x, y, raw, prefix, item}] with x,y = token origin on the baseline (page pt).
 */
export function parseSpotLevels(items, opts = {}) {
  const min = opts.min ?? -50, max = opts.max ?? 500, excl = new Set(opts.excludePrefixes || [...EXCLUDE_PREFIX]);
  const toks = mergeSplit(tokenize(items)); const out = [];
  toks.forEach((t, i) => {
    const m = LEVEL_RE.exec(t.str); if (!m) return;
    const value = parseFloat(t.str.replace("+", "")); if (!(value >= min && value <= max)) return;
    const prev = toks[i - 1]; let prefix = "";
    if (prev && prev.item === t.item && Math.abs(prev.y - t.y) < 1.5 && t.x - prev.x < 40) prefix = prev.str.toUpperCase().replace(/[^A-Z]/g, "");
    if (prefix && excl.has(prefix)) return;
    out.push({ value, decimals: m[2].length, x: t.x, y: t.y, raw: t.str, prefix, item: t.item, size: t.size });
  });
  return out;
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
/**
 * Grid method over a zone polygon (world metres). egl: surface fn (X,Y)->level|null. fel: number or fn.
 * opts: {cell=1, bands=DR_BANDS, sample:'corners'|'centre'}
 * Returns {cells:[{X,Y,egl,fel,depth,area}], summary:{area,cut,fill,avgCutDepth,maxDepth,byLayer,byMaxDepth,missing}}
 */
export function gridVolumes(poly, egl, fel, opts = {}) {
  const cell = opts.cell ?? 1, edges = opts.bands ?? DR_BANDS, sample = opts.sample ?? "corners", names = bandNames(edges);
  const felFn = typeof fel === "function" ? fel : () => fel;
  const xs = poly.map(p => p.X), ys = poly.map(p => p.Y); const x0 = Math.floor(Math.min(...xs) / cell) * cell, x1 = Math.max(...xs), y0 = Math.floor(Math.min(...ys) / cell) * cell, y1 = Math.max(...ys);
  const cells = []; let area = 0, cut = 0, fill = 0, missing = 0, maxDepth = 0; const byLayer = Object.fromEntries(names.map(n => [n, 0])), byMax = Object.fromEntries(names.map(n => [n, 0]));
  const a = cell * cell;
  for (let X = x0 + cell / 2; X < x1; X += cell) for (let Y = y0 + cell / 2; Y < y1; Y += cell) {
    if (!pointInPolygon(X, Y, poly)) continue;
    let g;
    if (sample === "corners") { const vs = [egl(X - cell / 2, Y - cell / 2), egl(X + cell / 2, Y - cell / 2), egl(X + cell / 2, Y + cell / 2), egl(X - cell / 2, Y + cell / 2)].filter(v => v != null); g = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null; }
    else g = egl(X, Y);
    const f = felFn(X, Y); area += a;
    if (g == null || f == null) { missing += a; cells.push({ X, Y, egl: g, fel: f, depth: null, area: a }); continue; }
    const d = g - f; cells.push({ X, Y, egl: g, fel: f, depth: d, area: a });
    if (d > 0) { cut += d * a; maxDepth = Math.max(maxDepth, d); const e = [0, ...edges, Infinity];
      for (let k = 0; k < names.length; k++) byLayer[names[k]] += Math.max(0, Math.min(d, e[k + 1]) - e[k]) * a;
      byMax[names[edges.filter(b => d >= b).length]] += d * a; }
    else fill += -d * a;
  }
  const cutArea = cells.filter(c => c.depth > 0).reduce((s, c) => s + c.area, 0);
  return { cells, summary: { area, cut, fill, avgCutDepth: cutArea ? cut / cutArea : 0, maxDepth, byLayer, byMaxDepth: byMax, missing, cell, bands: names } };
}
/** Approximate extra excavation for battered sides: sum over edges of (depth along edge)^2 * slopeH / 2 * length. slopeH = horizontal per 1 vertical. */
export function batterAllowance(poly, egl, fel, slopeH = 1, step = 1) {
  let vol = 0; const felFn = typeof fel === "function" ? fel : () => fel;
  for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length]; const L = Math.hypot(B.X - A.X, B.Y - A.Y); const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, X = A.X + (B.X - A.X) * t, Y = A.Y + (B.Y - A.Y) * t; const g = egl(X, Y), f = felFn(X, Y); if (g == null || f == null) continue; const d = Math.max(0, g - f); vol += d * d * slopeH / 2 * (L / n); } }
  return vol;
}
export function toCSV(rows, cols) { const esc = v => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\r\n"); }
export const fmt = (v, d = 1) => v == null ? "" : Number(v).toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });
