// pdf.js helpers shared by the browser app and the node tests: text items and small-path markers in page user space.
export async function pageTextItems(page) {
  const tc = await page.getTextContent();
  return tc.items.filter(i => typeof i.str === "string").map(i => { const [a, b, , , e, f] = i.transform; return { str: i.str, x: e, y: f, width: i.width, height: i.height, size: Math.hypot(a, b), angle: Math.atan2(b, a) * 180 / Math.PI }; });
}
/** Walk the operator list: returns {markers:[{x,y}], lines:[{x1,y1,x2,y2}]} where markers are centres of small paths (<= maxSize pt). */
export async function pageGeometry(page, OPS, opts = {}) {
  const maxSize = opts.maxSize ?? 8, minSize = opts.minSize ?? 0.5;
  const ops = await page.getOperatorList(); let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; const markers = [], lines = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ap = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm); else if (fn === OPS.restore) ctm = stack.pop() || ctm; else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.constructPath) {
      const [pops, coords] = Array.isArray(args[0]) ? [args[0], args[1]] : [[], []]; let k = 0; const pts = []; let cur = null;
      for (const op of pops) {
        if (op === OPS.moveTo || op === OPS.lineTo) { cur = ap(coords[k], coords[k + 1]); pts.push(cur); k += 2; }
        else if (op === OPS.curveTo) { pts.push(ap(coords[k + 4], coords[k + 5])); k += 6; } else if (op === OPS.curveTo2 || op === OPS.curveTo3) { pts.push(ap(coords[k + 2], coords[k + 3])); k += 4; }
        else if (op === OPS.rectangle) { const [x, y, w, h] = coords.slice(k, k + 4); pts.push(ap(x, y), ap(x + w, y), ap(x + w, y + h), ap(x, y + h)); k += 4; }
      }
      if (!pts.length) continue;
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (Math.max(w, h) <= maxSize && Math.max(w, h) >= minSize) markers.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
      if (pts.length === 2 && Math.max(w, h) > 100) lines.push({ x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] });
    }
  }
  return { markers, lines };
}
