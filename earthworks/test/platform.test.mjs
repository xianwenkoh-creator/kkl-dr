import { test } from "node:test"; import assert from "node:assert/strict";
import { parseSpotLevels, levelsInText, gradientsInText, parseSlopeText, parseBermText, slopeRules, designSurface, flatSurface, gridVolumes, preparePolygon, offsetDistance, formatRules } from "../engine.js";

const item = (str, x, y) => ({ str, x, y, width: str.length * 3.2, height: 6, size: 6, angle: 0 });
const rect = (x0, y0, x1, y1) => [{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }];
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const sum = o => Object.values(o).reduce((s, v) => s + (typeof v === "number" ? v : v.cut), 0);

test("datum-suffixed levels as on an ERSS plan are read, dimensions and decoys are not", () => {
  const items = [item("-12.00m SHD", 100, 500), item("-21.647mSHD", 100, 480), item("+4.0mSHD)", 100, 460), item("(-15.50m SHD)", 100, 440), item("0mSHD", 100, 420), item("ROAD ACCESS 10.0m WIDE (-15.50m SHD)", 100, 400), item("+5.50m SHD", 100, 380),
    item("173.6m", 300, 500), item("5m", 300, 480), item("N=36", 300, 460), item("1V:2.5H", 300, 440), item("1H:2V", 300, 420), item("10m Access Road", 300, 400), item("1m INTO MG", 300, 380), item("+0.0m +5.0m -5.0m -25.0m", 300, 360), item("12000", 300, 340), item("1:200", 300, 320), item("T+42", 300, 300), item("1125m3", 300, 280), item("Holding Pond-32", 300, 260), item("mSHD", 300, 240)];
  const got = parseSpotLevels(items);
  assert.deepEqual(got.map(l => l.value), [-12, -21.647, 4, -15.5, 0, -15.5, 5.5]);
  assert.ok(got.every(l => l.datum === "SHD"), "datum recorded"); assert.equal(got[0].raw, "-12.00m SHD"); assert.equal(got[0].decimals, 2); assert.equal(got[4].decimals, 0);
  assert.deepEqual(levelsInText("2. PRE-CUT EXISTING GROUND LEVEL TO +4.00m SHD. EXCAVATE TO -6.0mSHD, THEN TO FORMATION.").map(l => l.value), [4, -6]);
  const g = gradientsInText([item("1V:2.5H", 0, 0), item("1H:2V", 0, 0), item("1V:1H", 0, 0), item("1:200", 0, 0), item("1:12", 0, 0), item("1V:2.5H", 0, 0)]);
  assert.deepEqual(g.map(x => [x.text, x.count]), [["1V:2.5H", 2], ["1V:0.5H", 1], ["1V:1H", 1], ["1V:12H", 1]]);
});
test("slope rule text parses both notations, berms too", () => {
  assert.deepEqual(parseSlopeText("1V:1H to -6, 1:2.5 to +4"), [{ H: 1, top: -6 }, { H: 2.5, top: 4 }]);
  assert.deepEqual(parseSlopeText("1H:2V to -6mSHD; vertical"), [{ H: 0.5, top: -6 }, { H: 0, top: Infinity }]);
  assert.deepEqual(parseBermText("3 @ -12, 3m at -6"), [{ width: 3, level: -12 }, { width: 3, level: -6 }]);
  assert.equal(parseSlopeText("nothing"), null);
  const r = slopeRules(parseSlopeText("1V:1H to -6, 1:2.5"), parseBermText("3 @ -12, 3 @ -6")); assert.equal(formatRules(r), "1V:1H to -6.00; 1V:2.5H above | berms 3 m @ -12.00, 3 m @ -6.00");
});
test("rise and reach follow the section: 1:1 below -6 with 3 m berms at -12 and -6, then 1:2.5", () => {
  const r = slopeRules([{ top: -6, H: 1 }, { top: Infinity, H: 2.5 }], [{ level: -12, width: 3 }, { level: -6, width: 3 }]);
  const cases = [[0, -18], [6, -12], [7.5, -12], [9, -12], [12, -9], [15, -6], [16, -6], [18, -6], [20.5, -5], [43, 4], [50, 6.8]];
  for (const [d, z] of cases) close(r.rise(-18, d), z, 1e-9, `rise(-18, ${d})`);
  close(r.reach(-18, 4), 43, 1e-9, "reach -18 to +4"); close(r.reach(-12, 4), 34, 1e-9, "reach -12 to +4"); close(r.rise(-12, 0), -12, 1e-9, "platform on a berm level");
  const v = slopeRules([{ top: Infinity, H: 0 }]); assert.equal(v.rise(-6, 0.5), Infinity); assert.equal(v.reach(-6, 4), 0);
});
test("rectangular platform with battered sides matches the analytic mitred-offset volume, rounded corners give less", () => {
  const L = 100, W = 60, FEL = -12, EGL = 4; const poly = rect(60, 60, 160, 120), boundary = rect(0, 0, 220, 180);
  const r = slopeRules([{ top: -6, H: 1 }, { top: Infinity, H: 2.5 }], [{ level: -6, width: 3 }]);
  const wAt = z => z <= -6 ? z + 12 : 9 + 2.5 * (z + 6);                                        // horizontal offset at level z
  const integrate = A => { let v = 0; const dz = 0.0005; for (let z = FEL + dz / 2; z < EGL; z += dz) v += A(wAt(z)) * dz; return v; };
  const mitred = integrate(w => (L + 2 * w) * (W + 2 * w)), rounded = integrate(w => L * W + 2 * w * (L + W) + Math.PI * w * w);
  const egl = flatSurface(EGL);
  const dm = designSurface([{ name: "P", poly, fel: FEL, sides: "rules" }], r, egl, { top: EGL });
  const gm = gridVolumes(boundary, egl, dm, { cell: 0.5, bands: [1.5, 3, 6], levels: [-6], sample: "centre" });
  close(gm.summary.cut, mitred, mitred * 0.004, "mitred total"); assert.ok(mitred > rounded);
  close(gm.summary.byTag.P.cut, L * W * (EGL - FEL), 1, "footprint cut is exact"); close(gm.summary.byTag["P slopes"].cut, mitred - L * W * 16, mitred * 0.004, "slope cut");
  const above = (() => { let v = 0; const dz = 0.0005; for (let z = -6 + dz / 2; z < EGL; z += dz) v += (L + 2 * wAt(z)) * (W + 2 * wAt(z)) * dz; return v; })();
  close(gm.summary.byLevel["above -6.00"], above, above * 0.004, "stage above -6"); close(gm.summary.byLevel["below -6.00"], mitred - above, mitred * 0.004, "stage below -6");
  close(sum(gm.summary.byLevel), gm.summary.cut, 1e-6, "levels sum"); close(sum(gm.summary.byLayer), gm.summary.cut, 1e-6, "layers sum"); close(sum(gm.summary.byTag), gm.summary.cut, 1e-6, "tags sum");
  assert.equal(gm.summary.fill, 0); assert.equal(gm.summary.missing, 0); close(gm.summary.maxDepth, 16, 1e-9, "max depth");
  const dr = designSurface([{ name: "P", poly, fel: FEL, sides: "rules" }], r, egl, { top: EGL, corners: "rounded" });
  const gr = gridVolumes(boundary, egl, dr, { cell: 0.5, sample: "centre" }); close(gr.summary.cut, rounded, rounded * 0.004, "rounded total");
  // offset distance: a diagonal point off the corner takes the mitred value (the larger of the two edge offsets)
  const prep = preparePolygon(poly); const o = offsetDistance(prep, 170, 130, "mitred"); close(o.d, 10, 1e-9, "mitred corner offset"); close(offsetDistance(prep, 170, 130, "rounded").d, Math.SQRT2 * 10, 1e-9, "rounded corner offset");
  assert.equal(offsetDistance(prep, 100, 100).inside, true);
});
test("adjacent platforms, a deeper sump, a vertical pre-cut and a graded ramp combine as the lowest surface", () => {
  const EGL = 5.5, boundary = rect(0, 0, 300, 220);
  const r = slopeRules([{ top: -6, H: 1 }, { top: Infinity, H: 2.5 }], [{ level: -12, width: 3 }, { level: -6, width: 3 }]);
  const platforms = [
    { name: "PRE-CUT", poly: boundary, fel: 4, sides: "vertical" },
    { name: "B2-2", poly: rect(60, 60, 180, 140), fel: -12, sides: "rules" },
    { name: "B2-3", poly: rect(180, 60, 270, 160), fel: -18, sides: "rules" },
    { name: "SUMP", poly: rect(200, 90, 240, 120), fel: -21.6, sides: "rules" },
    { name: "RAMP", poly: rect(110, 140, 120, 190), fel: { p1: { X: 115, Y: 140 }, z1: -12, p2: { X: 115, Y: 190 }, z2: -6 }, sides: "rules" }];
  const egl = flatSurface(EGL); const d = designSurface(platforms, r, egl, { top: EGL });
  const g = gridVolumes(boundary, egl, d, { cell: 1, levels: [4, -6, -12], sample: "centre" });
  close(g.summary.byLevel["above +4.00"], 300 * 220 * 1.5, 1e-6, "pre-cut stage is the boundary area times 1.5");
  const d4 = designSurface(platforms.slice(1), r, flatSurface(4), { top: 4 }); const g4 = gridVolumes(boundary, flatSurface(4), d4, { cell: 1, sample: "centre" });
  close(g.summary.cut, 300 * 220 * 1.5 + g4.summary.cut, 1e-6, "total = pre-cut + pits below +4");
  close(g.summary.byTag["RAMP"].cut, 10 * 50 * (5.5 + 9), 1, "ramp footprint at its mean level"); close(g.summary.byTag["SUMP"].cut, 40 * 30 * (5.5 + 21.6), 1, "sump footprint");
  // between B2-2 (-12) and B2-3 (-18) the surface is a 1:1 slope over 6 m then the -12 berm merges into B2-2
  close(d(177, 100), -15, 1e-9, "3 m into B2-2 from the shared edge: -18 + 3"); close(d(170, 100), -12, 1e-9, "B2-2 floor beyond the slope"); close(d(250, 180), -5.2, 1e-9, "20 m north of B2-3: 6 m to -12, berm 3, 6 m to -6, berm 3, then 2 m at 1:2.5"); close(r.rise(-18, 20), -5.2, 1e-9, "rise check");
  close(d(100, 30), r.rise(-12, 30), 1e-9, "south of B2-2 at 30 m"); close(d(150, 30), r.rise(-18, 30), 1e-9, "B2-3's mitred corner reaches further south-west than B2-2's edge"); assert.equal(d(5, 5), 4); assert.equal(d.at(5, 5).tag, "PRE-CUT");
  close(sum(g.summary.byTag), g.summary.cut, 1e-6, "tags sum"); close(sum(g.summary.byLevel), g.summary.cut, 1e-6, "levels sum"); assert.equal(g.summary.missing, 0);
});
