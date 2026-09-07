#!/usr/bin/env python3
"""Ground-truth capture spike: read measurement markups out of marked-up PDFs.

QSs who measure in Bluebeam Revu (or Acrobat, Foxit, PDF-XChange) leave every measurement in
the PDF as a standard annotation: Line (/L), PolyLine or Polygon (/Vertices), with an ISO 32000
/Measure dictionary carrying the scale and Bluebeam-private keys such as /Subj (subject).
A nightly job over the tender and claims folders can therefore log (sheet, page, item, geometry,
value) for every takeoff a QS does, with no change to how they work. This spike:
  1. stamps three measurement annotations onto sample_drawing.pdf the way Revu stores them
  2. reads them back with PyMuPDF only (no Bluebeam), recovering subject, vertices, scale, value
  3. checks the values against the ground truth
Usage: python3 extract_markups.py
"""
import json, math, os, re
import pymupdf

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "sample_drawing.pdf"); out = os.path.join(here, "sample_markups.pdf")
truth = json.load(open(os.path.join(here, "sample_drawing.truth.json")))
PT_TO_M = 25.4 / 72 / 1000 * truth["scale"]
MEASURE = (f"<</Type/Measure/Subtype/RL/R(1:{truth['scale']})"
           f"/X[<</Type/NumberFormat/U(m)/C {PT_TO_M:.6f}/D 100>>]"
           f"/A[<</Type/NumberFormat/U(sq m)/C {PT_TO_M**2:.8f}/D 100>>]>>")

# 1. stamp markups the way a QS's Revu session leaves them --------------------------------
doc = pymupdf.open(src); page = doc[0]; H = page.rect.height
tl = lambda x, y: pymupdf.Point(x, H - y)                  # drawing coords (y up) -> page coords (y down)
a = page.add_line_annot(tl(120, 620), tl(420, 620)); a.set_info(subject="DR-PIPE 300 dia", title="QS Tan"); a.update()
doc.xref_set_key(a.xref, "Measure", MEASURE); doc.xref_set_key(a.xref, "IT", "/LineDimension")
a = page.add_polyline_annot([tl(120, 260), tl(760, 260), tl(760, 380)]); a.set_info(subject="DR-RCU 600x600", title="QS Tan"); a.update()
doc.xref_set_key(a.xref, "Measure", MEASURE); doc.xref_set_key(a.xref, "IT", "/PolyLineDimension")
a = page.add_polygon_annot([tl(180, 430), tl(700, 430), tl(700, 560), tl(180, 560)]); a.set_info(subject="RW-ACWC asphalt", title="QS Lim"); a.update()
doc.xref_set_key(a.xref, "Measure", MEASURE); doc.xref_set_key(a.xref, "IT", "/PolygonDimension")
doc.save(out); doc.close()

# 2. the extractor: what the nightly job runs over every PDF in the takeoff folders ----------
def parse_measure(s):
    """metres per PDF unit and sq metres per sq unit from a /Measure dictionary string."""
    x = re.search(r"/X\s*\[.*?/C\s*([\d.eE+-]+)", s or ""); a = re.search(r"/A\s*\[.*?/C\s*([\d.eE+-]+)", s or "")
    return (float(x.group(1)) if x else None, float(a.group(1)) if a else None)
def shoelace(pts):
    return abs(sum(pts[i].x * pts[(i+1) % len(pts)].y - pts[(i+1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
def extract(pdf_path):
    doc = pymupdf.open(pdf_path); rows = []
    for pno, page in enumerate(doc):
        for an in page.annots():
            kind = an.type[1]                                  # 'Line', 'PolyLine', 'Polygon', ...
            if kind not in ("Line", "PolyLine", "Polygon", "Square", "Circle"): continue
            m_per_unit, m2_per_unit = parse_measure(doc.xref_get_key(an.xref, "Measure")[1])
            verts = an.vertices or []
            pts = [pymupdf.Point(v) if not isinstance(v, pymupdf.Point) else v for v in (verts if kind != "Line" else verts)]
            if kind == "Line" and len(verts) == 2 and not isinstance(verts[0], (tuple, list, pymupdf.Point)):
                pts = [pymupdf.Point(verts[0], verts[1])]  # defensive; PyMuPDF returns [(x1,y1),(x2,y2)] for lines
            info = an.info
            row = {"file": os.path.basename(pdf_path), "page": pno + 1, "kind": kind, "subject": info.get("subject", ""),
                   "author": info.get("title", ""), "vertices_pt": [(round(p.x, 2), round(p.y, 2)) for p in pts],
                   "scale_m_per_pt": m_per_unit}
            if kind in ("Line", "PolyLine") and m_per_unit and len(pts) >= 2:
                row["value"] = round(sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1)) * m_per_unit, 2); row["unit"] = "m"
            elif kind == "Polygon" and (m2_per_unit or m_per_unit) and len(pts) >= 3:
                row["value"] = round(shoelace(pts) * (m2_per_unit or m_per_unit ** 2), 1); row["unit"] = "m2"
            rows.append(row)
    return rows

rows = extract(out)
print(f"{len(rows)} measurement markups found in {os.path.basename(out)}")
expect = {"DR-PIPE 300 dia": (300 * PT_TO_M, "m"), "DR-RCU 600x600": (truth["drains"][2]["length_m"], "m"), "RW-ACWC asphalt": (truth["road_area_m2"], "m2")}
ok = True
for r in rows:
    want = expect.get(r["subject"]); got = r.get("value")
    err = (got - want[0]) if (want and got is not None) else None
    ok &= err is not None and abs(err) < 0.05 * (1 if want[1] == "m" else 10)
    print(f"  p{r['page']} {r['kind']:9} {r['subject']:18} by {r['author']:7} {len(r['vertices_pt'])} vertices  value {got} {r.get('unit','')}   expected {want[0]:.2f} {want[1]}   err {err:+.2f}")
json.dump(rows, open(os.path.join(here, "sample_markups.json"), "w"), indent=1)
print("RESULT:", "every markup recovered with geometry, scale, subject and value" if ok else "MISMATCH")
