#!/usr/bin/env python3
"""Feasibility spike: the CAD route (DWG/DXF).

Writes the same drainage plan as a DXF the way a CAD user would draw it - layers per item
class, sump symbols as block inserts, asphalt and footpath as hatches, model space in metres -
then measures it back. No scale detection is needed: model space is already in real units.
Needs: pip install ezdxf.  (DWG needs a converter first, e.g. ODA File Converter to DXF.)
"""
import json, math, os
import ezdxf
from ezdxf.math import area as poly_area

here = os.path.dirname(os.path.abspath(__file__))
truth = json.load(open(os.path.join(here, "sample_drawing.truth.json")))
PT_TO_M = 25.4 / 72 / 1000 * truth["scale"]        # only used to place the same geometry in metres
m = lambda x, y: (x * PT_TO_M, y * PT_TO_M)

doc = ezdxf.new("R2018"); doc.units = ezdxf.units.M
for name, color in (("DR-PIPE", 5), ("DR-RCU", 3), ("DR-SUMP", 1), ("RW-ACWC", 8), ("RW-FP", 9), ("TEXT", 7), ("LEGEND", 7)):
    doc.layers.add(name, color=color)
sump = doc.blocks.new("SUMP"); sump.add_lwpolyline([(-0.7, -0.7), (0.7, -0.7), (0.7, 0.7), (-0.7, 0.7)], close=True)
msp = doc.modelspace()
drains = [("D1", "300 dia RC pipe", "DR-PIPE", [(120, 620), (420, 620), (420, 380)]),
          ("D2", "450 dia RC pipe", "DR-PIPE", [(420, 380), (760, 380)]),
          ("D3", "U-drain 600x600", "DR-RCU", [(120, 260), (760, 260), (760, 380)]),
          ("D4", "600 dia RC pipe", "DR-PIPE", [(760, 380), (980, 520), (980, 700)])]
for d, spec, layer, pts in drains:
    pl = msp.add_lwpolyline([m(*p) for p in pts], dxfattribs={"layer": layer})
    pl.dxf.const_width = 0
    mx, my = m((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2)
    msp.add_text(f"{d} {spec}", dxfattribs={"layer": "TEXT", "height": 1.4}).set_placement((mx + 1, my + 1))
for x, y in [(120, 620), (420, 620), (420, 380), (760, 380), (980, 520), (980, 700), (120, 260), (760, 260)]:
    msp.add_blockref("SUMP", m(x, y), dxfattribs={"layer": "DR-SUMP"})
for layer, pts in (("RW-ACWC", [(180, 430), (700, 430), (700, 560), (180, 560)]), ("RW-FP", [(180, 560), (700, 560), (700, 590), (180, 590)])):
    h = msp.add_hatch(dxfattribs={"layer": layer}); h.paths.add_polyline_path([m(*p) for p in pts], is_closed=True)
# legend drawn in model space too (bad practice, but common) - on its own layer
msp.add_blockref("SUMP", m(60, 760), dxfattribs={"layer": "LEGEND"})
msp.add_lwpolyline([m(56, 740), m(100, 740)], dxfattribs={"layer": "LEGEND"})
dxf_path = os.path.join(here, "sample_drawing.dxf"); doc.saveas(dxf_path)

# ---- measure it back: this is the whole takeoff engine for the CAD route ----
doc = ezdxf.readfile(dxf_path); msp = doc.modelspace()
def pl_length(pl):
    pts = [(p[0], p[1]) for p in pl.get_points()]
    L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    return L + (math.dist(pts[-1], pts[0]) if pl.closed else 0)
lengths, counts, areas = {}, {}, {}
for e in msp.query("LWPOLYLINE"):
    lengths[e.dxf.layer] = lengths.get(e.dxf.layer, 0) + pl_length(e)
for e in msp.query("INSERT"):
    key = f"{e.dxf.layer}:{e.dxf.name}"; counts[key] = counts.get(key, 0) + 1
for e in msp.query("HATCH"):
    for path in e.paths:
        verts = [(v[0], v[1]) for v in path.vertices]
        areas[e.dxf.layer] = areas.get(e.dxf.layer, 0) + abs(poly_area(verts))
# labels: nearest TEXT starting with D<n> to each polyline midpoint
texts = [(t.dxf.insert, t.dxf.text) for t in msp.query("TEXT")]
per_run = {}
for e in msp.query("LWPOLYLINE[layer=='DR-PIPE' | layer=='DR-RCU']"):
    pts = [(p[0], p[1]) for p in e.get_points()]; mid = ((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2)
    lab = min(texts, key=lambda t: math.dist((t[0][0], t[0][1]), mid))[1].split()[0]
    per_run[lab] = per_run.get(lab, 0) + pl_length(e)

print("layers found:", ", ".join(l.dxf.name for l in doc.layers if l.dxf.name != "0"))
ok = True
for d in truth["drains"]:
    got = per_run.get(d["id"], 0); ok &= abs(got - d["length_m"]) < 0.05
    print(f"  {d['id']} {d['spec']:18} measured {got:8.2f} m   truth {d['length_m']:8.2f}   err {got - d['length_m']:+.2f}")
got = counts.get("DR-SUMP:SUMP", 0); ok &= got == truth["sump_count"]
print(f"  sumps (INSERT of block SUMP on layer DR-SUMP) {got}   truth {truth['sump_count']}   (legend insert on layer LEGEND ignored: {counts.get('LEGEND:SUMP', 0)})")
for layer, key in (("RW-ACWC", "road_area_m2"), ("RW-FP", "footpath_area_m2")):
    got = areas.get(layer, 0); ok &= abs(got - truth[key]) < 0.5
    print(f"  {layer:8} hatch area measured {got:8.1f} m2  truth {truth[key]:8.1f}   err {got - truth[key]:+.1f}")
print("RESULT:", "all quantities match ground truth; no scale needed, layers and blocks name the classes" if ok else "MISMATCH")
