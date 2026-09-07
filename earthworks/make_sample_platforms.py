#!/usr/bin/env python3
"""Synthetic ERSS-style excavation layout plan with known earthworks truth.

Mimics the kind of sheet a main contractor issues for a deep open-cut excavation: an A1 plan at 1:1000 with the
contractor boundary (sheetpile cut-off line), formation platforms labelled in metres to datum ('-12.00m SHD'), a
graded access ramp with spot levels, a local sump, top-of-slope and berm outlines, section markers, boreholes,
gradients written as '1V:2.5H' / '1H:2V', SPT values, dimensions, and a title block with 'Scale- 1:1000'.
No spot levels: the existing ground is a stated level (reclaimed platform +5.50m SHD, pre-cut to +4.00m SHD).

Truth is computed independently of the JS engine: mitred offsets of convex platforms as the largest signed edge
distance, the section's slope rules applied as a vectorised rise function, integrated on a 0.25 m grid.

Outputs (same folder): sample_platforms.pdf, sample_platforms.truth.json
"""
import json, math, os
import numpy as np

SCALE = 1000
PT_TO_M = 25.4 / 72 / 1000 * SCALE                 # 0.35278 m per pt at 1:1000
W, H = 2383.94, 1683.78                            # A1 landscape
def pt(X, Y): return (X / PT_TO_M, Y / PT_TO_M)   # world metres (origin = page origin) -> page points

EGL = 5.50                                         # existing reclaimed platform
BANDS = [(-6.0, 1.0), (math.inf, 2.5)]             # (top level, H per 1 V): 1V:1H below -6, 1V:2.5H above
BERMS = {-12.0: 3.0, -6.0: 3.0}                    # level: width
STAGES = [4.0, -6.0, -12.0]                        # stage cut-offs: pre-cut to +4, bulk to -6, to -12, below
BOUNDARY = [(150, 120), (650, 120), (650, 480), (150, 480)]
def rect(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
PLATFORMS = [
    {"name": "PRE-CUT", "poly": BOUNDARY, "fel": 4.00, "sides": "vertical", "label": "+4.00m SHD", "label_at": (160, 470)},
    {"name": "B2-2", "poly": rect(250, 200, 370, 280), "fel": -12.00, "sides": "rules", "label": "-12.00m SHD", "label_at": (296, 238)},
    {"name": "B2-3", "poly": rect(370, 200, 520, 330), "fel": -18.00, "sides": "rules", "label": "-18.00m SHD", "label_at": (430, 300)},
    {"name": "SUMP", "poly": rect(420, 240, 460, 270), "fel": -21.60, "sides": "rules", "label": "(-21.60m SHD)", "label_at": (424, 253)},
    {"name": "LAYDOWN", "poly": rect(200, 330, 330, 430), "fel": -6.00, "sides": "rules", "label": "-6.00m SHD", "label_at": (250, 378)},
    {"name": "RAMP", "poly": rect(300, 280, 310, 330), "fel": {"p1": (305, 280), "z1": -12.0, "p2": (305, 330), "z2": -6.0}, "sides": "rules", "label": None, "label_at": None},
]

# ---- truth: design surface = min over platforms of (fel inside | rise(fel at nearest edge point, mitred offset)) capped by EGL ----
def H_at(z):
    out = np.full_like(z, BANDS[-1][1], dtype=float)
    for top, h in reversed(BANDS):
        if np.isfinite(top): out = np.where(z < top - 1e-9, h, out)
    return out
def rise(fel, d):
    z = np.array(fel, dtype=float) * np.ones_like(d) if np.ndim(fel) == 0 else fel.astype(float).copy(); rem = d.astype(float).copy(); out = np.full_like(d, np.nan, dtype=float)
    events = sorted(set([t for t, _ in BANDS if np.isfinite(t)] + list(BERMS)))
    for L in events:
        active = np.isnan(out) & (z < L - 1e-9); h = H_at(z); need = h * (L - z)
        done = active & (rem <= need); out[done] = z[done] + rem[done] / h[done]
        adv = active & ~done; rem[adv] -= need[adv]; z[adv] = L
        if L in BERMS:
            w = BERMS[L]; done2 = adv & (rem <= w); out[done2] = L; rem[adv & ~done2] -= w
    last = np.isnan(out); h = H_at(z); out[last] = z[last] + rem[last] / h[last]
    return out
def signed_edges(poly, X, Y):
    """Outward signed distance to every edge line of a convex polygon (any orientation): list of arrays."""
    n = len(poly); area2 = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n)); ccw = area2 > 0
    out = []
    for i in range(n):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy)
        nx, ny = (dy / L, -dx / L) if ccw else (-dy / L, dx / L); out.append((X - ax) * nx + (Y - ay) * ny)
    return out
def nearest_point(poly, X, Y):
    n = len(poly); bd = np.full_like(X, np.inf); qx = X.copy(); qy = Y.copy()
    for i in range(n):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1); px, py = ax + dx * t, ay + dy * t; d = np.hypot(X - px, Y - py)
        m = d < bd; bd = np.where(m, d, bd); qx = np.where(m, px, qx); qy = np.where(m, py, qy)
    return qx, qy
def fel_of(p, X, Y):
    f = p["fel"]
    if isinstance(f, dict):
        (x1, y1), (x2, y2) = f["p1"], f["p2"]; dx, dy = x2 - x1, y2 - y1; t = np.clip(((X - x1) * dx + (Y - y1) * dy) / (dx * dx + dy * dy), 0, 1); return f["z1"] + (f["z2"] - f["z1"]) * t
    return np.full_like(X, f, dtype=float)
step = 0.25
xs = np.arange(BOUNDARY[0][0] + step / 2, BOUNDARY[1][0], step); ys = np.arange(BOUNDARY[0][1] + step / 2, BOUNDARY[2][1], step)
X, Y = np.meshgrid(xs, ys); design = np.full_like(X, EGL); tag = np.full(X.shape, -1, dtype=int); inside_tag = np.zeros(X.shape, dtype=bool)
for i, p in enumerate(PLATFORMS):
    se = signed_edges(p["poly"], X, Y); w = np.maximum.reduce(se); inside = w <= 1e-9; w = np.maximum(w, 0)
    if p["sides"] == "vertical": env = np.where(inside, fel_of(p, X, Y), np.inf)
    else:
        qx, qy = nearest_point(p["poly"], X, Y); env = np.where(inside, fel_of(p, X, Y), rise(fel_of(p, qx, qy), w))
    better = env < design; design = np.where(better, env, design); tag = np.where(better, i, tag); inside_tag = np.where(better, inside, inside_tag)
depth = EGL - design; a = step * step
by_tag = {}
for i, p in enumerate(PLATFORMS):
    for inside, suffix in [(True, ""), (False, " slopes")]:
        m = (tag == i) & (inside_tag == inside); v = float(depth[m].sum() * a)
        if v > 0: by_tag[p["name"] + suffix] = round(v, 1)
cuts = sorted(STAGES, reverse=True); bounds = [math.inf] + cuts + [-math.inf]; names = [f"above {cuts[0]:+.2f}"] + [f"{cuts[i]:+.2f} to {cuts[i-1]:+.2f}" for i in range(1, len(cuts))] + [f"below {cuts[-1]:+.2f}"]
by_level = {names[k]: round(float(np.clip(np.minimum(EGL, bounds[k]) - np.maximum(design, bounds[k + 1]), 0, None).sum() * a), 1) for k in range(len(names))}
DB = [1.5, 3.0, 6.0]; e = [0] + DB + [1e9]; bn = ["<1.5", "1.5-3", "3-6", ">6"]
by_layer = {bn[k]: round(float(np.clip(np.minimum(depth, e[k + 1]) - e[k], 0, None).sum() * a), 1) for k in range(4)}
truth = {"scale": SCALE, "pt_to_m": PT_TO_M, "page_pt": [W, H], "egl": EGL, "rules": {"bands": [{"top": (None if not np.isfinite(t) else t), "H": h} for t, h in BANDS], "berms": [{"level": l, "width": w} for l, w in BERMS.items()]},
         "rules_text": "1V:1H to -6, 1V:2.5H", "berms_text": "3 @ -12, 3 @ -6", "stages": STAGES, "boundary_m": BOUNDARY, "boundary_pt": [list(pt(*q)) for q in BOUNDARY],
         "platforms": [{"name": p["name"], "fel": p["fel"], "sides": p["sides"], "poly_m": p["poly"], "poly_pt": [list(pt(*q)) for q in p["poly"]], "label": p["label"], "label_pt": list(pt(*p["label_at"])) if p["label_at"] else None} for p in PLATFORMS],
         "area_m2": round(float(X.size * a), 1), "cut_m3": round(float(depth.sum() * a), 1), "max_depth_m": round(float(depth.max()), 3), "cut_by_tag_m3": by_tag, "cut_by_level_m3": by_level, "cut_by_layer_m3": by_layer}

# ---- PDF writer (raw content streams, no dependencies) ----
def esc(s): return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
class Page:
    def __init__(self): self.ops = []
    def rgb(self, r, g, b, stroke=True): self.ops.append(f"{r} {g} {b} {'RG' if stroke else 'rg'}")
    def width(self, w): self.ops.append(f"{w} w")
    def dash(self, on=None): self.ops.append(f"[{on}] 0 d" if on else "[] 0 d")
    def line(self, a, b): self.ops.append(f"{a[0]:.2f} {a[1]:.2f} m {b[0]:.2f} {b[1]:.2f} l S")
    def poly(self, pts, close=True): self.ops.append(" ".join(f"{x:.2f} {y:.2f} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + (" h S" if close else " S"))
    def text(self, x, y, s, size=7, rot=0):
        if rot: c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot)); self.ops.append(f"BT /F1 {size} Tf {c:.4f} {s_:.4f} {-s_:.4f} {c:.4f} {x:.2f} {y:.2f} Tm ({esc(s)}) Tj ET")
        else: self.ops.append(f"BT /F1 {size} Tf {x:.2f} {y:.2f} Td ({esc(s)}) Tj ET")
def write_pdf(path, pages):
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", None]; kids = []; font_id = 3 + 2 * len(pages)
    for i, p in enumerate(pages):
        content = "\n".join(p.ops).encode("latin-1"); pid = 3 + 2 * i
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Contents {pid + 1} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode())
        objs.append(b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream"); kids.append(f"{pid} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>".encode(); objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out); out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for o in offs: out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode(); open(path, "wb").write(out)

# ---- the plan ----
p = Page()
p.rgb(0, 0, 0); p.width(1.5); p.poly([(30, 30), (W - 30, 30), (W - 30, H - 30), (30, H - 30)])
# title block (bottom right)
p.width(0.8); p.line((W - 620, 30), (W - 620, 250)); p.line((W - 620, 250), (W - 30, 250))
for (y, s, sz) in [(226, "PROJECT TITLE: PROPOSED DEVELOPMENT OF A TERMINAL SUBSTRUCTURE (SAMPLE)", 8), (208, "DRAWING TITLE: ERSS LAYOUT PLAN (FOR EXCAVATION)", 9), (190, "MAIN CONTRACTOR: SAMPLE JV      CONTRACTOR'S C&S CONSULTANT: SAMPLE GEO PTE LTD", 7), (172, "DRAWING NO. XX-CIV-SD-20200   REV C1   STAGE S4   SUIT. CODE A   SHEET SIZE A1", 7), (154, "Scale- 1:1000   DATE 2024-07-15   DRAWN HK   CHECKED ML   APPROVED HTUN", 7), (136, "CONFIDENTIAL - SAMPLE SHEET FOR SOFTWARE TESTING ONLY", 7)]:
    p.text(W - 610, y, s, sz)
# notes (top left)
p.text(60, H - 70, "NOTES:", 9)
for k, s in enumerate(["1. ALL LEVELS IN METRES TO SHD. EXISTING RECLAIMED PLATFORM AT +5.50m SHD.", "2. PRE-CUT EXISTING GROUND LEVEL TO +4.00m SHD WITHIN THE SHEETPILE CUT-OFF WALL BEFORE OPEN-CUT EXCAVATION.",
                       "3. OPEN-CUT BATTERS: 1V:2.5H IN FILL / MG ABOVE -6.00m SHD; 1V:1H IN OLD ALLUVIUM BELOW -6.00m SHD; 3m BERMS AT -6.00m SHD AND -12.00m SHD.",
                       "4. ACCESS RAMP 10m WIDE, GRADIENT 1:8.3, FROM -6.00m SHD TO -12.00m SHD. LOCAL SUMP 40m x 30m TO -21.60m SHD.", "5. REFER TO SECTIONS C4, C4A, D2, D3 AND E4 (CIV-SD-90022 TO 90026) FOR SLOPE PROTECTION AND GIW."]):
    p.text(60, H - 92 - 16 * k, s, 7)
# contractor boundary = sheetpile line
p.rgb(0.75, 0.1, 0.1); p.width(1.4); p.dash("12 5"); p.poly([pt(*q) for q in BOUNDARY]); p.dash()
p.rgb(0, 0, 0); p.text(pt(152, 484)[0], pt(152, 484)[1], "CONTRACTOR BOUNDARY / SHEET PILE WATER CUT-OFF WALL @ +5.50m SHD", 7); p.text(pt(600, 484)[0], pt(600, 484)[1], "+5.50m SHD", 7)
# platforms: toe outline solid, top-of-slope and berm outlines dashed (rectangles offset by the section's horizontal distances)
def reach_from(fel, top):
    z, d = fel, 0.0
    for L in sorted(set([t for t, _ in BANDS if np.isfinite(t)] + list(BERMS))):
        if L <= fel + 1e-9 or L >= top: continue
        d += float(H_at(np.array([z]))[0]) * (L - z); z = L; d += BERMS.get(L, 0.0)
    return d + float(H_at(np.array([z]))[0]) * (top - z)
p.rgb(0, 0, 0.75); p.width(1.0)
for plat in PLATFORMS:
    if plat["name"] == "PRE-CUT": continue
    p.poly([pt(*q) for q in plat["poly"]])
    (x0, y0), (x1, y1) = plat["poly"][0], plat["poly"][2]
    if plat["sides"] == "rules" and not isinstance(plat["fel"], dict):
        p.dash("3 3"); p.width(0.5)
        for lvl in [-12.0, -6.0, 4.0]:
            if lvl <= plat["fel"] + 1e-9: continue
            w = reach_from(plat["fel"], lvl); p.poly([pt(x0 - w, y0 - w), pt(x1 + w, y0 - w), pt(x1 + w, y1 + w), pt(x0 - w, y1 + w)])
        p.dash(); p.width(0.4)
        for xx in np.arange(x0 + 5, x1, 10): p.line(pt(xx, y0), pt(xx, y0 - 6))     # slope hatching ticks along the south edge
        p.width(1.0)
p.rgb(0, 0, 0)
for plat in PLATFORMS:
    if plat["label"]:
        x, y = pt(*plat["label_at"]); p.text(x, y + 9, plat["name"] if plat["name"] != "PRE-CUT" else "PRE-CUT PLATFORM", 8); p.text(x, y, plat["label"], 8)
# ramp spot levels every 10 m (1.2 m of fall), written the '-9.600mSHD' way
for k in range(6):
    x, y = pt(312, 280 + 10 * k); p.text(x, y, f"{-12 + 1.2 * k:.3f}mSHD", 6)
p.text(pt(312, 305)[0] + 40, pt(312, 305)[1], "ACCESS RAMP 10.0m WIDE (1:8.3)", 6, rot=90)
# section markers, boreholes, gradients, dimensions and other decoys as on the real sheet
for (x, y, s) in [(240, 190, "SECTION D2"), (530, 265, "SECTION C4A"), (265, 440, "SECTION E4"), (380, 340, "SECTION D3"), (560, 330, "1V:2.5H"), (560, 320, "1H:2V"), (245, 240, "1V:1H"), (373, 240, "1V:1H"),
                  (420, 190, "173.6m"), (240, 285, "5m"), (240, 292, "3m"), (330, 450, "T+42"), (540, 440, "Holding Pond-32 1125m3"), (540, 430, "-5.50m SHD"), (600, 400, "STOCKPILE AREA 0.00m SHD"), (600, 160, "LAYDOWN AREA"),
                  (200, 150, "ABH-18b-07"), (300, 150, "A0186"), (400, 150, "MBH 419"), (500, 150, "ITT-Z6-BH03"), (330, 200, "N=36"), (340, 200, "N=100"), (200, 460, "KP1A"), (480, 460, "KP2B"), (560, 300, "10m Access Road"), (470, 470, "1m INTO MG"),
                  (610, 470, "CIV-SD-90025"), (610, 462, "1308 1310 1312 1314"), (160, 130, "E3"), (170, 130, "E1A"), (620, 130, "12000")]:
    xx, yy = pt(x, y); p.text(xx, yy, s, 6)
# bar scale (1:1000: 100 m = 283.46 pt)
bx, by = 80, 60; p.width(1.0); p.line((bx, by), (bx + 100 / PT_TO_M, by))
for k in range(0, 101, 20): x = bx + k / PT_TO_M; p.line((x, by - 3), (x, by + 3)); p.text(x - 4, by + 6, f"{k}", 6)
p.text(bx + 100 / PT_TO_M + 8, by - 2, "Metres  Scale 1:1000", 7)
# north arrow
p.line((W - 700, H - 80), (W - 700, H - 130)); p.text(W - 704, H - 70, "N", 9)

here = os.path.dirname(os.path.abspath(__file__))
write_pdf(os.path.join(here, "sample_platforms.pdf"), [p]); json.dump(truth, open(os.path.join(here, "sample_platforms.truth.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in truth.items() if k not in ("platforms", "boundary_pt")}, indent=1)); print("platforms:", [(q["name"], q["fel"]) for q in truth["platforms"]])
