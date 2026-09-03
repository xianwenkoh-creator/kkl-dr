#!/usr/bin/env python3
"""Synthetic topographical survey sheet + design sheet with known earthworks truth.

Mimics what a QS receives: an A3 1:500 topo plan with spot levels as small '+' markers and a level
label beside each, an E/N coordinate grid with labels, decoy numbers (chainages, coordinates,
dimensions, a date, gradients), a title block; and a design sheet listing platform / formation levels
per zone with notes. Ground is an analytic surface so truth volumes are exact (fine-grid integration).

Outputs (same folder): sample_topo.pdf, sample_design.pdf, sample_topo.truth.json
"""
import json, math, os, random
import numpy as np

SCALE = 500
PT_TO_M = 25.4 / 72 / 1000 * SCALE          # 0.17639 m per pt
W, H = 1190.55, 841.89                        # A3 landscape
ORIGIN_PT = (80.0, 90.0)                      # page point that maps to E0,N0
E0, N0 = 21000.0, 31000.0                     # SVY21-like grid origin at ORIGIN_PT
def pt(e, n): return (ORIGIN_PT[0] + (e - E0) / PT_TO_M, ORIGIN_PT[1] + (n - N0) / PT_TO_M)
def ground(e, n):                              # existing ground level in metres (SHD-like)
    x, y = e - E0, n - N0
    return 102.0 + 0.012 * x + 0.006 * y + 0.8 * math.sin(x / 25.0) * math.cos(y / 30.0)

random.seed(7)
# spot levels on a jittered 10 m grid over 180 m x 120 m
spots = []
for i in range(19):
    for j in range(13):
        e = E0 + 5 + i * 9.5 + random.uniform(-2.5, 2.5); n = N0 + 5 + j * 9.0 + random.uniform(-2.5, 2.5)
        spots.append((round(e, 3), round(n, 3), round(ground(e, n), 2)))
# excavation zones (polygons in E,N) and final excavation levels
zones = {
    "A": {"fel": 98.50, "poly": [(E0+30, N0+20), (E0+110, N0+20), (E0+110, N0+70), (E0+30, N0+70)]},
    "B": {"fel": 101.20, "poly": [(E0+120, N0+30), (E0+170, N0+30), (E0+170, N0+100), (E0+140, N0+100), (E0+140, N0+60), (E0+120, N0+60)]},
}
# truth by fine-grid integration of the analytic surface (0.25 m cells), depth bands by layer and by max depth
BANDS = [1.5, 3.0, 6.0]
def poly_contains(px, py, poly):
    inside = False; n = len(poly)
    for k in range(n):
        x1, y1 = poly[k]; x2, y2 = poly[(k + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: inside = not inside
    return inside
truth = {"scale": SCALE, "pt_to_m": PT_TO_M, "origin_pt": ORIGIN_PT, "grid_origin": [E0, N0], "spot_count": len(spots),
         "spots": [{"e": e, "n": n, "level": z, "x_pt": round(pt(e, n)[0], 3), "y_pt": round(pt(e, n)[1], 3)} for e, n, z in spots], "zones": {}}
for name, zn in zones.items():
    xs = [p[0] for p in zn["poly"]]; ys = [p[1] for p in zn["poly"]]
    step = 0.25; cut = fill = area = 0.0; layer = {b: 0.0 for b in ["<1.5", "1.5-3", "3-6", ">6"]}; maxd = {b: 0.0 for b in layer}
    e = min(xs) + step / 2
    while e < max(xs):
        n = min(ys) + step / 2
        while n < max(ys):
            if poly_contains(e, n, zn["poly"]):
                d = ground(e, n) - zn["fel"]; a = step * step; area += a
                if d > 0:
                    cut += d * a
                    edges = [0] + BANDS + [1e9]; names = list(layer)
                    for k in range(4):
                        lo, hi = edges[k], edges[k + 1]; layer[names[k]] += max(0.0, min(d, hi) - lo) * a
                    band = names[sum(1 for b in BANDS if d >= b)]; maxd[band] += d * a
                else: fill += -d * a
            n += step
        e += step
    truth["zones"][name] = {"fel": zn["fel"], "poly_en": zn["poly"], "poly_pt": [list(pt(*p)) for p in zn["poly"]],
                            "area_m2": round(area, 1), "cut_m3": round(cut, 1), "fill_m3": round(fill, 1),
                            "cut_by_layer_m3": {k: round(v, 1) for k, v in layer.items()}, "cut_by_max_depth_m3": {k: round(v, 1) for k, v in maxd.items()}}

# ---- PDF writer (raw content streams, no dependencies) ----
def esc(s): return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
class Page:
    def __init__(self): self.ops = []
    def rgb(self, r, g, b, stroke=True): self.ops.append(f"{r} {g} {b} {'RG' if stroke else 'rg'}")
    def width(self, w): self.ops.append(f"{w} w")
    def line(self, a, b): self.ops.append(f"{a[0]:.2f} {a[1]:.2f} m {b[0]:.2f} {b[1]:.2f} l S")
    def poly(self, pts, close=True): self.ops.append(" ".join(f"{x:.2f} {y:.2f} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + (" h S" if close else " S"))
    def text(self, x, y, s, size=7, rot=0):
        if rot: c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot)); self.ops.append(f"BT /F1 {size} Tf {c:.4f} {s_:.4f} {-s_:.4f} {c:.4f} {x:.2f} {y:.2f} Tm ({esc(s)}) Tj ET")
        else: self.ops.append(f"BT /F1 {size} Tf {x:.2f} {y:.2f} Td ({esc(s)}) Tj ET")
def write_pdf(path, pages):
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", None]
    kids = []; font_id = 3 + 2 * len(pages)
    for i, p in enumerate(pages):
        content = "\n".join(p.ops).encode("latin-1"); pid = 3 + 2 * i
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Contents {pid + 1} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode())
        objs.append(b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream"); kids.append(f"{pid} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>".encode()
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out); out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for o in offs: out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    open(path, "wb").write(out)

# ---- topo sheet ----
p = Page()
p.rgb(0, 0, 0); p.width(1.2); p.poly([(20, 20), (W - 20, 20), (W - 20, H - 20), (20, H - 20)])
p.width(0.8); p.line((W - 360, 20), (W - 360, 120)); p.line((W - 360, 120), (W - 20, 120))
p.text(W - 350, 100, "TOPOGRAPHICAL SURVEY PLAN", 9); p.text(W - 350, 84, "LOT 1234X MK 22   SVY21 GRID   SHD LEVELS", 7)
p.text(W - 350, 68, "DWG NO: TS-01   REV: A   DATE: 12 AUG 2026", 7); p.text(W - 350, 52, "SCALE 1:500 @ A3", 7); p.text(W - 350, 36, "SURVEYOR: ABC LAND SURVEYORS PTE LTD", 7)
# coordinate grid every 50 m with labels (E along bottom/top, N along left/right)
p.rgb(0.55, 0.55, 0.55); p.width(0.3)
for k in range(0, 5):
    e = E0 + k * 50; x = pt(e, N0)[0]; p.line((x, 30), (x, H - 130)); p.text(x + 2, 32, f"E {e:.0f}", 6, rot=90)
for k in range(0, 4):
    n = N0 + k * 50; y = pt(E0, n)[1]; p.line((30, y), (W - 30, y)); p.text(32, y + 2, f"N {n:.0f}", 6)
# spot levels: '+' marker (two 3 pt strokes) and label to the upper right, 2 decimals; a few with 3 decimals
p.rgb(0, 0, 0); p.width(0.5)
for i, (e, n, z) in enumerate(spots):
    x, y = pt(e, n); p.line((x - 1.5, y), (x + 1.5, y)); p.line((x, y - 1.5), (x, y + 1.5))
    label = f"{z:.3f}" if i % 17 == 0 else f"{z:.2f}"
    p.text(x + 2.0, y + 1.5, label, 5)
# decoys: chainage, dimensions, gradient, a bare coordinate pair, tree spot heights with 'H'
p.text(300, 700, "CH 1+250.00", 6); p.text(500, 700, "12000", 6); p.text(560, 700, "1:200", 6); p.text(640, 700, "21567.345", 6); p.text(720, 700, "H 12.5", 6)
p.text(300, 690, "MH 102.35 IL 100.12", 6)   # manhole cover level and invert: cover is a level, keep it out via context (MH/IL prefixes)
# site boundary
p.rgb(0.8, 0.1, 0.1); p.width(1.0); p.poly([pt(E0 + 10, N0 + 10), pt(E0 + 180, N0 + 10), pt(E0 + 180, N0 + 110), pt(E0 + 10, N0 + 110)])
topo = p

# ---- design sheet: excavation plan with zone outlines and level notes ----
d = Page()
d.rgb(0, 0, 0); d.width(1.2); d.poly([(20, 20), (W - 20, 20), (W - 20, H - 20), (20, H - 20)])
d.width(0.8); d.line((W - 360, 20), (W - 360, 120)); d.line((W - 360, 120), (W - 20, 120))
d.text(W - 350, 100, "EXCAVATION PLAN", 9); d.text(W - 350, 84, "PROPOSED BASEMENT AND PLATFORM WORKS", 7); d.text(W - 350, 68, "DWG NO: C-102   REV: B", 7); d.text(W - 350, 52, "SCALE 1:500 @ A3", 7)
d.rgb(0, 0, 0.8); d.width(1.0)
for name, zn in zones.items():
    pts_ = [pt(*q) for q in zn["poly"]]; d.poly(pts_); cx = sum(q[0] for q in pts_) / len(pts_); cy = sum(q[1] for q in pts_) / len(pts_)
    d.rgb(0, 0, 0); d.text(cx - 40, cy + 6, f"ZONE {name}", 8); d.text(cx - 40, cy - 6, f"FORMATION LEVEL RL {zn['fel']:.3f}", 7); d.rgb(0, 0, 0.8)
d.rgb(0, 0, 0)
d.text(60, 780, "NOTES:", 8)
d.text(60, 766, "1. ZONE A: BASEMENT. SSL 99.000. SLAB 400 THK, BLINDING 50 THK, HARDCORE 50 THK. FORMATION LEVEL = 98.500.", 6)
d.text(60, 754, "2. ZONE B: PLATFORM. PLATFORM LEVEL RL 101.500 LESS 300 THK GRANULAR SUB-BASE. FORMATION LEVEL = 101.200.", 6)
d.text(60, 742, "3. ALL LEVELS IN METRES TO SHD. EXCAVATION MEASURED NETT, VERTICAL SIDES, NO WORKING SPACE.", 6)
d.text(60, 730, "4. LOCAL DEEPENING AT LIFT PIT: 1.500 BELOW FORMATION (NOT SHOWN).", 6)
design = d

here = os.path.dirname(os.path.abspath(__file__))
write_pdf(os.path.join(here, "sample_topo.pdf"), [topo]); write_pdf(os.path.join(here, "sample_design.pdf"), [design])
json.dump(truth, open(os.path.join(here, "sample_topo.truth.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in truth.items() if k != "spots"}, indent=1)[:1500]); print("spots:", len(spots))
