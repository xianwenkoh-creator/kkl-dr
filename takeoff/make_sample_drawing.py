#!/usr/bin/env python3
"""Generate a synthetic vector drainage layout PDF with known ground truth.

No dependencies: writes raw PDF content streams. Mimics what a CAD-to-PDF export
looks like: layers separated by stroke colour and line weight, sump symbols as
small closed squares, a filled road area, a title block with SCALE 1:500,
a scale bar, and text labels near each drain run.

Ground truth is written next to the PDF as sample_drawing.truth.json.
"""
import json, math, os, sys

SCALE = 500                       # 1:500
PT_TO_M = 25.4 / 72 / 1000 * SCALE  # metres per PDF point at this scale (0.17639 m)
W, H = 1190.55, 841.89            # A3 landscape in points

def m_to_pt(m): return m / PT_TO_M

# --- ground truth in real-world metres, laid out on the sheet in points ---
drains = [  # id, size, polyline vertices in points
    ("D1", "300 dia RC pipe",  [(120, 620), (420, 620), (420, 380)]),
    ("D2", "450 dia RC pipe",  [(420, 380), (760, 380)]),
    ("D3", "U-drain 600x600",  [(120, 260), (760, 260), (760, 380)]),
    ("D4", "600 dia RC pipe",  [(760, 380), (980, 520), (980, 700)]),
]
sumps = [(120, 620), (420, 620), (420, 380), (760, 380), (980, 520), (980, 700), (120, 260), (760, 260)]
road = [(180, 430), (700, 430), (700, 560), (180, 560)]          # closed filled polygon (asphalt)
footpath = [(180, 560), (700, 560), (700, 590), (180, 590)]      # thinner strip, different fill

def plen(pts): return sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))
def parea(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i+1) % len(pts)]
        s += x1*y2 - x2*y1
    return abs(s) / 2

truth = {
    "scale": SCALE,
    "drains": [{"id": d, "spec": s, "length_m": round(plen(p)*PT_TO_M, 2)} for d, s, p in drains],
    "sump_count": len(sumps),
    "road_area_m2": round(parea(road)*PT_TO_M**2, 1),
    "footpath_area_m2": round(parea(footpath)*PT_TO_M**2, 1),
}

# --- content stream ---
ops = []
def rgb(r, g, b, stroke=True): ops.append(f"{r} {g} {b} {'RG' if stroke else 'rg'}")
def width(w): ops.append(f"{w} w")
def path(pts, close=False, fill=False, stroke=True):
    ops.append(f"{pts[0][0]:.2f} {pts[0][1]:.2f} m " + " ".join(f"{x:.2f} {y:.2f} l" for x, y in pts[1:]) + (" h" if close else ""))
    ops.append("B" if (fill and stroke) else ("f" if fill else "S"))
def text(x, y, s, size=9, font="F1"):
    s = s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    ops.append(f"0 0 0 rg BT /{font} {size} Tf {x:.2f} {y:.2f} Td ({s}) Tj ET")

# sheet border and title block
rgb(0, 0, 0); width(1.2); path([(20, 20), (W-20, 20), (W-20, H-20), (20, H-20)], close=True)
width(0.8); path([(W-380, 20), (W-380, 140), (W-20, 140)])
text(W-370, 120, "KOH KOCK LEONG ENTERPRISE PTE LTD", 10)
text(W-370, 100, "PROJECT: SAMPLE ROAD AND DRAINAGE WORKS", 8)
text(W-370, 84, "TITLE: DRAINAGE LAYOUT PLAN", 8)
text(W-370, 66, "DWG NO: C-201   REV: B", 8)
text(W-370, 48, "SCALE 1:500 @ A3      DATE: 03 SEP 2026", 8)
text(W-370, 32, "CHECKED: ---   APPROVED: ---", 8)

# north arrow (a decoy shape that is not a quantity)
rgb(0, 0, 0); width(1.0); path([(1080, 720), (1080, 790)]); path([(1072, 775), (1080, 790), (1088, 775)])
text(1074, 796, "N", 10)

# scale bar: 0 to 100 m
rgb(0, 0, 0); width(2.0); path([(60, 60), (60 + m_to_pt(100), 60)])
width(0.8)
for k in range(0, 101, 25):
    x = 60 + m_to_pt(k); path([(x, 55), (x, 65)]); text(x-6, 42, f"{k}", 7)
text(60 + m_to_pt(100) + 8, 57, "m", 8)

# road area (asphalt): grey fill, thin outline  -> layer RW-ACWC
rgb(0.75, 0.75, 0.75, stroke=False); rgb(0.4, 0.4, 0.4); width(0.5); path(road, close=True, fill=True)
# footpath: light fill -> layer RW-FP
rgb(0.9, 0.9, 0.85, stroke=False); rgb(0.4, 0.4, 0.4); width(0.5); path(footpath, close=True, fill=True)
text(400, 490, "ASPHALT CARRIAGEWAY", 8); text(400, 572, "FOOTPATH", 7)

# drains: blue, 1.5 pt (pipes) / green 1.5 pt (U-drain) -> layers DR-PIPE / DR-RCU
for d, s, p in drains:
    if "U-drain" in s: rgb(0, 0.55, 0)
    else: rgb(0, 0, 1)
    width(1.5); path(p)
    mx = (p[0][0] + p[1][0]) / 2; my = (p[0][1] + p[1][1]) / 2
    rgb(0, 0, 0); text(mx + 6, my + 6, f"{d} {s}", 8)

# sumps: red 8x8 pt closed squares -> layer DR-SUMP (block symbol)
rgb(1, 0, 0); width(1.0)
for x, y in sumps:
    path([(x-4, y-4), (x+4, y-4), (x+4, y+4), (x-4, y+4)], close=True)

# a decoy: legend box with the same symbols (must NOT be counted)
rgb(0, 0, 0); width(0.8); path([(40, 700), (300, 700), (300, 800), (40, 800)], close=True)
text(50, 785, "LEGEND", 9)
rgb(1, 0, 0); width(1.0); path([(56, 756), (64, 756), (64, 764), (56, 764)], close=True); rgb(0,0,0); text(72, 757, "SUMP / MANHOLE", 8)
rgb(0, 0, 1); width(1.5); path([(56, 740), (100, 740)]); rgb(0,0,0); text(108, 737, "RC PIPE DRAIN", 8)
rgb(0, 0.55, 0); width(1.5); path([(56, 722), (100, 722)]); rgb(0,0,0); text(108, 719, "PRECAST U-DRAIN", 8)

content = "\n".join(ops).encode("latin-1")

objs = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
    b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]
out = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; offsets = []
for i, o in enumerate(objs, 1):
    offsets.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
xref = len(out)
out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
for off in offsets: out += f"{off:010d} 00000 n \n".encode()
out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()

here = os.path.dirname(os.path.abspath(__file__))
open(os.path.join(here, "sample_drawing.pdf"), "wb").write(out)
json.dump(truth, open(os.path.join(here, "sample_drawing.truth.json"), "w"), indent=2)
print(json.dumps(truth, indent=2))
