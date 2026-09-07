#!/usr/bin/env python3
"""Feasibility spike: what a SCANNED drawing gives you.

Rasterises the sample at 150 dpi (a typical scan resolution) and measures with classical
computer vision only - no vector data, no text. Shows the precision gap versus the vector
route, and why scans need OCR of the scale text and a human confirming class mapping.
Usage: python3 extract_raster.py [sample_drawing.pdf] [dpi]
"""
import json, os, sys
import numpy as np, cv2, pymupdf

here = os.path.dirname(os.path.abspath(__file__))
pdf_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "sample_drawing.pdf")
dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 150
truth = json.load(open(pdf_path.replace(".pdf", ".truth.json")))
scale = truth["scale"]                      # a scan needs OCR for this; taken from truth here
M_PER_PX = 25.4 / dpi / 1000 * scale        # metres per pixel

pix = pymupdf.open(pdf_path)[0].get_pixmap(dpi=dpi)
img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].copy()
# simulate a scan: slight blur and JPEG-like noise
img = cv2.GaussianBlur(img, (3, 3), 0)
noise = np.random.default_rng(1).integers(-6, 7, img.shape, dtype=np.int16)
img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
r, g, b = cv2.split(img)   # PyMuPDF samples are RGB, not BGR

def mask_colour(pred): return (pred).astype(np.uint8) * 255
blue  = mask_colour((b > 150) & (r < 110) & (g < 110))
green = mask_colour((g > 100) & (r < 90) & (b < 90))
red   = mask_colour((r > 150) & (g < 110) & (b < 110))
grey  = mask_colour((abs(r.astype(int) - 191) < 14) & (abs(g.astype(int) - 191) < 14) & (abs(b.astype(int) - 191) < 14))
black = mask_colour((r < 80) & (g < 80) & (b < 80))

# legend box: a closed black rectangle much smaller than the sheet -> exclusion zone
exclude = np.zeros(black.shape, np.uint8)
contours, _ = cv2.findContours(black, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
sheet_area = black.shape[0] * black.shape[1]
for c in contours:
    approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
    a = cv2.contourArea(c)
    if len(approx) == 4 and 0.01 * sheet_area < a < 0.3 * sheet_area:
        cv2.drawContours(exclude, [approx], -1, 255, -1)
def outside_legend(m): return cv2.bitwise_and(m, cv2.bitwise_not(exclude))

def skeleton_length_px(mask):
    """Zhang-Suen thinning, then sum of 8-connected step lengths along the skeleton."""
    sk = (mask > 0).astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            p = np.pad(sk, 1)
            P2, P3, P4, P5, P6, P7, P8, P9 = (p[:-2,1:-1], p[:-2,2:], p[1:-1,2:], p[2:,2:], p[2:,1:-1], p[2:,:-2], p[1:-1,:-2], p[:-2,:-2])
            nb = [P2, P3, P4, P5, P6, P7, P8, P9]
            B = sum(nb)
            A = sum(((nb[i] == 0) & (nb[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8))
            if step == 0: cond = (P2 * P4 * P6 == 0) & (P4 * P6 * P8 == 0)
            else:         cond = (P2 * P4 * P8 == 0) & (P2 * P6 * P8 == 0)
            rm = (sk == 1) & (B >= 2) & (B <= 6) & (A == 1) & cond
            if rm.any(): sk[rm] = 0; changed = True
    ys, xs = np.nonzero(sk)
    pts = set(zip(ys.tolist(), xs.tolist()))
    L = 0.0
    for y, x in pts:          # count each undirected edge once: only look right/down/diagonals
        if (y, x + 1) in pts: L += 1
        if (y + 1, x) in pts: L += 1
        if (y + 1, x + 1) in pts and not ((y, x + 1) in pts or (y + 1, x) in pts): L += 2 ** 0.5
        if (y + 1, x - 1) in pts and not ((y, x - 1) in pts or (y + 1, x) in pts): L += 2 ** 0.5
    return L

def count_blobs(mask, min_px, max_px):
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    return sum(1 for i in range(1, n) if min_px <= stats[i, cv2.CC_STAT_AREA] <= max_px)

pipe_m  = skeleton_length_px(outside_legend(blue)) * M_PER_PX
udr_m   = skeleton_length_px(outside_legend(green)) * M_PER_PX
sumps   = count_blobs(outside_legend(red), 20, 2000)
road_m2 = (outside_legend(grey) > 0).sum() * M_PER_PX ** 2

t_pipe = sum(d["length_m"] for d in truth["drains"] if "pipe" in d["spec"])
t_udr  = sum(d["length_m"] for d in truth["drains"] if "U-drain" in d["spec"])
print(f"raster at {dpi} dpi, {M_PER_PX*1000:.0f} mm per pixel at 1:{scale}; legend excluded by detecting its box")
rows = [("RC pipe drains total (m)", pipe_m, t_pipe), ("U-drain total (m)", udr_m, t_udr),
        ("sumps (no)", sumps, truth["sump_count"]), ("asphalt area (m2)", road_m2, truth["road_area_m2"])]
for name, got, want in rows:
    err = (got - want) / want * 100 if want else 0
    print(f"  {name:28} measured {got:9.1f}   truth {want:9.1f}   error {err:+.1f}%")
print("NOTE: run lengths per drain ID, pipe sizes and the scale itself would all need OCR and label association on a scan;")
print("      line crossings, text over lines and hatching typically add several percent of error on real scans.")
