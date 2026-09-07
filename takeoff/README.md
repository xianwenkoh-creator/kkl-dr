# Takeoff engine — feasibility spikes

Evidence for the takeoff system plan (`research/takeoff-system-plan.md`). Everything here runs
offline on a synthetic drawing with known quantities, so the numbers are exact tests of the
measuring code, not of any AI model.

| File | What it does |
|---|---|
| `make_sample_drawing.py` | Writes `sample_drawing.pdf`, an A3 drainage layout plan at 1:500 the way a CAD export looks: classes separated by stroke colour and line weight, sump symbols as small closed squares, a filled asphalt area and footpath, a legend box (decoy symbols that must not be counted), a title block with `SCALE 1:500`, a scale bar and a north arrow. Ground truth goes to `sample_drawing.truth.json`. No dependencies. |
| `extract_pymupdf.py` | Vector route, Python (PyMuPDF). Reads the scale from the title block, pulls every path with colour/width/closure, clusters paths by signature, **learns the legend** (symbol signature → legend text), names filled areas from the text inside them, excludes the legend box and title block, measures lengths/areas/counts, attaches the nearest run label, cross-checks the scale bar, compares with truth. |
| `extract_pdfjs.mjs` | Same measurement with pdf.js 4.10.38, i.e. the route that can run inside a browser page like `ai/index.html` with no server. Walks the operator list with a graphics-state stack. `npm install pdfjs-dist@4.10.38` to run. |
| `extract_dxf.py` | CAD route: writes the same plan as `sample_drawing.dxf` the way a CAD user draws it (layers per class, sump symbols as block inserts, asphalt and footpath as hatches, model space in metres) and measures it back with ezdxf. No scale detection at all. `pip install ezdxf`. DWG needs a converter to DXF first (ODA File Converter). |
| `calc_trench.py` | Calculation layer: turns the measured primitives (run length, size, ground and invert levels) into trench excavation by KKL depth band, bedding and surround, backfill, disposal and pipe/U-drain lengths, rolled up to KKL activity codes. Writes `sample_drawing.quantities.json`. No dependencies. |
| `extract_markups.py` | Ground-truth capture: stamps Bluebeam-style measurement annotations (Line, PolyLine, Polygon with an ISO 32000 `/Measure` scale and a `/Subj` item name) onto the sample sheet, then reads them back with PyMuPDF alone, recovering subject, author, vertices, scale and value. This is the nightly job that turns the QSs' existing marked-up PDFs into labelled training data with no change to how they work. Writes `sample_markups.pdf` and `sample_markups.json`. |
| `extract_raster.py` | Scanned-drawing route: rasterises the sample at 150 or 300 dpi with blur and noise, then measures with classical computer vision only (colour masks, thinning, blob counting). Needs `opencv-python-headless`. |

## Results (3 Sep 2026)

Vector route, both libraries, on `sample_drawing.pdf`:

| Item | Measured | Truth |
|---|---|---|
| D1 300 dia RC pipe | 95.25 m | 95.25 m |
| D2 450 dia RC pipe | 59.97 m | 59.97 m |
| D3 U-drain 600x600 | 134.06 m | 134.06 m |
| D4 600 dia RC pipe | 77.75 m | 77.75 m |
| Sumps | 8 | 8 |
| Asphalt carriageway | 2103.2 m² | 2103.2 m² |
| Footpath | 485.4 m² | 485.4 m² |
| Scale bar check | 100.0 m | 100 m |

CAD route (`sample_drawing.dxf`): all quantities exact; sump count from block inserts on layer
DR-SUMP (the legend's copy on layer LEGEND is ignored); areas from hatch boundaries; run labels
from TEXT entities. No scale is needed because model space is already in metres.

Legend learned automatically: red 1.0 pt closed square → SUMP / MANHOLE; blue 1.5 pt line → RC PIPE
DRAIN; green 1.5 pt line → PRECAST U-DRAIN. Fills named from the text inside them.

Raster route (simulated scan of the same sheet):

| Item | 150 dpi | 300 dpi |
|---|---|---|
| RC pipe drains total | +6.7 % | +0.4 % |
| U-drain total | +7.0 % | −1.6 % |
| Sumps | 9 of 8 | 8 of 8 |
| Asphalt area | +2.3 % | −0.5 % |

Markup capture (`extract_markups.py`): three Revu-style measurements read back exactly
(52.92 m line, 134.06 m polyline, 2103.2 m² polygon) with item subject and author. Real Revu
files add custom columns (`/BSIColumnData`) and per-viewport scales (`/VP`), to be verified on
one real KKL PDF.

Calculation layer (`calc_trench.py`): the four measured runs, their sizes and eight level pairs
produce about twenty BQ lines (EW-EXCT by depth band, EW-BF, EW-HARD, EW-DISP, DR-PIPE by
diameter, DR-RCU, DR-SUMP) from rules a QS applies by hand today. The rules are illustrative
and must be replaced by KKL's own.

What this proves and what it does not:

- Most quantities are calculations, not measurements. Once the primitives are trusted, the
  depth-band excavation, backfill and disposal lines are deterministic code.
- DWG/DXF is the best input: layers and blocks already name the classes and the units are real.
  Asking clients and main contractors for CAD files is worth more than any amount of AI.
- A vector PDF from CAD carries exact geometry. Reading the scale, clustering by drawing signature,
  learning the legend and measuring is deterministic code, and a browser can do it.
- A scan is a different problem. Even a clean 300 dpi scan of a simple sheet lands within about
  2 % on lengths and areas, and 150 dpi is not good enough for money-bearing quantities. Real scans
  add text over lines, crossings, hatching and skew, and need OCR for the scale and labels.
- The synthetic sheet has no curves, no hatching, no overlapping layers and no multiple viewports.
  Real drawings have all of these; the plan treats them as the work of the first months.
