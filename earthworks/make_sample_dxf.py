#!/usr/bin/env python3
"""Synthetic ERSS-style excavation layout as a DXF in SVY21 metres, with truth. The kind of file a main contractor's
CAD team issues: platform toe lines as closed polylines on one layer, level labels as TEXT and MTEXT (some inside
blocks), a contractor boundary, slope hatching, dimensions and notes on other layers, a ramp with end levels.
Outputs: sample_platforms.dxf, sample_platforms.dxf.truth.json
"""
import json, os
import ezdxf

E0, N0 = 45900.0, 35000.0                      # SVY21-like origin, Changi East
def rect(x0, y0, x1, y1): return [(E0 + x0, N0 + y0), (E0 + x1, N0 + y0), (E0 + x1, N0 + y1), (E0 + x0, N0 + y1)]
BOUNDARY = rect(150, 120, 650, 480)
PLATFORMS = [
    {"name": "B2-2", "poly": rect(250, 200, 370, 280), "fel": -12.00, "label": "-12.00m SHD", "at": (300, 240), "kind": "TEXT"},
    {"name": "B2-3", "poly": rect(370, 200, 520, 330), "fel": -18.00, "label": "-18.00m SHD", "at": (440, 300), "kind": "MTEXT"},
    {"name": "SUMP", "poly": rect(420, 240, 460, 270), "fel": -21.60, "label": "(-21.60m SHD)", "at": (430, 255), "kind": "TEXT"},
    {"name": "LAYDOWN", "poly": rect(200, 330, 330, 430), "fel": -6.00, "label": "-6.00m SHD", "at": (250, 380), "kind": "BLOCK"},
    {"name": "B1-2-1", "poly": [(E0 + 540, N0 + 200), (E0 + 620, N0 + 200), (E0 + 620, N0 + 300), (E0 + 580, N0 + 340), (E0 + 540, N0 + 300)], "fel": -15.50, "label": "-15.50m SHD", "at": (570, 250), "kind": "TEXT"},
]
RAMP = {"poly": rect(300, 280, 310, 330), "z1": -12.0, "z2": -6.0}

doc = ezdxf.new("R2010"); doc.header["$INSUNITS"] = 6
for name, color in [("C-ERSS-PLATFORM", 5), ("C-ERSS-SLOPE", 8), ("C-ERSS-TEXT", 7), ("C-BOUNDARY", 1), ("C-DIMS", 3), ("C-NOTES", 7), ("C-STRUCT", 4)]: doc.layers.add(name, color=color)
blk = doc.blocks.new(name="LVL_LABEL"); blk.add_text("-6.00m SHD", dxfattribs={"height": 2.0, "layer": "C-ERSS-TEXT"}).set_placement((0, 0))
msp = doc.modelspace()
msp.add_lwpolyline(BOUNDARY, close=True, dxfattribs={"layer": "C-BOUNDARY"})
for p in PLATFORMS:
    msp.add_lwpolyline(p["poly"], close=True, dxfattribs={"layer": "C-ERSS-PLATFORM"})
    x, y = E0 + p["at"][0], N0 + p["at"][1]
    if p["kind"] == "TEXT": msp.add_text(p["label"], dxfattribs={"height": 2.0, "layer": "C-ERSS-TEXT"}).set_placement((x, y))
    elif p["kind"] == "MTEXT": msp.add_mtext("{\\fArial|b0|i0;" + p["name"] + "\\P" + p["label"] + "}", dxfattribs={"char_height": 2.0, "layer": "C-ERSS-TEXT"}).set_location((x, y))
    else: msp.add_blockref("LVL_LABEL", (x, y), dxfattribs={"layer": "C-ERSS-TEXT", "xscale": 1.0, "yscale": 1.0, "rotation": 0})
    # slope hatching ticks and a top-of-slope line on the slope layer (decoys for the platform picker)
    (x0, y0), (x1, y1) = p["poly"][0], p["poly"][2]
    for xx in range(int(x0) + 5, int(x1), 10): msp.add_line((xx, y0), (xx, y0 - 6), dxfattribs={"layer": "C-ERSS-SLOPE"})
    msp.add_lwpolyline([(x0 - 30, y0 - 30), (x1 + 30, y0 - 30), (x1 + 30, y1 + 30), (x0 - 30, y1 + 30)], close=True, dxfattribs={"layer": "C-ERSS-SLOPE"})
msp.add_lwpolyline(RAMP["poly"], close=True, dxfattribs={"layer": "C-ERSS-PLATFORM"})
msp.add_text("-12.00mSHD", dxfattribs={"height": 1.5, "layer": "C-ERSS-TEXT"}).set_placement((E0 + 302, N0 + 282))
msp.add_text("-6.00mSHD", dxfattribs={"height": 1.5, "layer": "C-ERSS-TEXT"}).set_placement((E0 + 302, N0 + 327))
# a structure outline that is NOT a platform (closed, on another layer), dimensions and notes
msp.add_lwpolyline(rect(400, 400, 480, 450), close=True, dxfattribs={"layer": "C-STRUCT"})
for (x, y, s) in [(420, 190, "173.6m"), (240, 285, "5m"), (560, 330, "1V:2.5H"), (560, 320, "1H:2V"), (245, 240, "1V:1H"), (330, 200, "N=36"), (600, 400, "STOCKPILE AREA 0.00m SHD"), (160, 470, "PRE-CUT PLATFORM +4.00m SHD"), (600, 484, "+5.50m SHD")]:
    msp.add_text(s, dxfattribs={"height": 1.5, "layer": "C-DIMS" if s[0].isdigit() else "C-NOTES"}).set_placement((E0 + x, N0 + y))
msp.add_mtext("NOTES:\\P1. ALL LEVELS IN METRES TO SHD.\\P2. PRE-CUT TO +4.00m SHD.", dxfattribs={"char_height": 2.0, "layer": "C-NOTES"}).set_location((E0 + 60, N0 + 560))
here = os.path.dirname(os.path.abspath(__file__)); doc.saveas(os.path.join(here, "sample_platforms.dxf"))
def area(poly):
    a = 0
    for i in range(len(poly)): x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]; a += x1 * y2 - x2 * y1
    return abs(a) / 2
truth = {"boundary": BOUNDARY, "platforms": [{"name": p["name"], "fel": p["fel"], "poly": p["poly"], "area": area(p["poly"]), "label": p["label"]} for p in PLATFORMS], "ramp": {"poly": RAMP["poly"], "z1": RAMP["z1"], "z2": RAMP["z2"], "area": area(RAMP["poly"])}, "layers": ["C-ERSS-PLATFORM", "C-ERSS-SLOPE", "C-ERSS-TEXT", "C-BOUNDARY", "C-DIMS", "C-NOTES", "C-STRUCT"]}
json.dump(truth, open(os.path.join(here, "sample_platforms.dxf.truth.json"), "w"), indent=1); print("wrote sample_platforms.dxf", os.path.getsize(os.path.join(here, "sample_platforms.dxf")), "bytes;", len(PLATFORMS), "platforms + ramp")
