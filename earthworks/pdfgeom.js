// pdf.js helpers shared by the browser app and the node tests: text items and small-path markers in page user space.
export async function pageTextItems(page) {
  const tc = await page.getTextContent();
  return tc.items.filter(i => typeof i.str === "string").map(i => { const [a, b, , , e, f] = i.transform; return { str: i.str, x: e, y: f, width: i.width, height: i.height, size: Math.hypot(a, b), angle: Math.atan2(b, a) * 180 / Math.PI }; });
}
/**
 * Walk the operator list. Returns {markers:[{x,y}], lines:[{x1,y1,x2,y2}], paths:[...], pens:{key:{...}}}.
 * markers are centres of small paths (<= maxSize pt); paths carry every vector path with its pen (stroke colour,
 * line width in pt, dashed or solid), whether it is closed and how it was painted, so closed outlines drawn in one
 * pen (the toe lines of an excavation) can be picked out the way DXF layers are.
 */
export async function pageGeometry(page, OPS, opts = {}) {
  const maxSize = opts.maxSize ?? 8, minSize = opts.minSize ?? 0.5;
  const ops = await page.getOperatorList(); let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; const markers = [], lines = [], paths = [], pens = {};
  let rgb = "#000000", width = 1, dashed = false; const penStack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ap = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const hex = v => { const a = Array.isArray(v) ? v : Object.values(v || {}); if (a.length < 3) return "#000000"; const m = Math.max(...a.slice(0, 3)) <= 1 ? 255 : 1; return "#" + a.slice(0, 3).map(c => Math.round(c * m).toString(16).padStart(2, "0")).join(""); };
  const PAINT = { [OPS.stroke]: "stroke", [OPS.closeStroke]: "stroke", [OPS.fill]: "fill", [OPS.eoFill]: "fill", [OPS.fillStroke]: "fillStroke", [OPS.eoFillStroke]: "fillStroke", [OPS.closeFillStroke]: "fillStroke", [OPS.closeEOFillStroke]: "fillStroke", [OPS.endPath]: "none" };
  const CLOSERS = new Set([OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) { stack.push(ctm); penStack.push([rgb, width, dashed]); } else if (fn === OPS.restore) { ctm = stack.pop() || ctm; [rgb, width, dashed] = penStack.pop() || [rgb, width, dashed]; } else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.setStrokeRGBColor) rgb = hex(args); else if (fn === OPS.setLineWidth) width = +args[0]; else if (fn === OPS.setDash) { const d = Array.isArray(args[0]) ? args[0] : []; dashed = d.length > 0 && d.some(v => v > 0); }
    else if (fn === OPS.constructPath) {
      const [pops, coords] = Array.isArray(args[0]) ? [args[0], args[1]] : [[], []]; let k = 0; const pts = []; let closedOp = false;
      for (const op of pops) {
        if (op === OPS.moveTo || op === OPS.lineTo) { pts.push(ap(coords[k], coords[k + 1])); k += 2; }
        else if (op === OPS.curveTo) { pts.push(ap(coords[k + 4], coords[k + 5])); k += 6; } else if (op === OPS.curveTo2 || op === OPS.curveTo3) { pts.push(ap(coords[k + 2], coords[k + 3])); k += 4; }
        else if (op === OPS.rectangle) { const [x, y, w, h] = coords.slice(k, k + 4); pts.push(ap(x, y), ap(x + w, y), ap(x + w, y + h), ap(x, y + h)); closedOp = true; k += 4; }
        else if (op === OPS.closePath) closedOp = true;
      }
      if (!pts.length) continue;
      const next = ops.fnArray[i + 1]; const painted = PAINT[next] ?? "stroke"; const closed = closedOp || CLOSERS.has(next) || (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01);
      if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) pts.pop();
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (Math.max(w, h) <= maxSize && Math.max(w, h) >= minSize) markers.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
      if (pts.length === 2 && Math.max(w, h) > 100) lines.push({ x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] });
      if (painted === "none") continue;
      const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1; const wpt = +(width * scale).toFixed(2); const key = `${rgb}/${wpt}/${dashed ? "dash" : "solid"}`;
      let a2 = 0; for (let q = 0; q < pts.length; q++) { const p1 = pts[q], p2 = pts[(q + 1) % pts.length]; a2 += p1[0] * p2[1] - p2[0] * p1[1]; }
      paths.push({ pts, closed, area: closed ? Math.abs(a2) / 2 : 0, bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }, pen: { key, rgb, width: wpt, dashed }, painted });
      const pen = pens[key] || (pens[key] = { key, rgb, width: wpt, dashed, count: 0, closed: 0 }); pen.count++; if (closed && pts.length > 2) pen.closed++;
    }
  }
  return { markers, lines, paths, pens };
}
