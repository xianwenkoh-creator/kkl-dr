# KKL DR tools
Internal daily-report site-capture tools. index.html = DR Capture, verify.html = Engineer Verify.

The SKYTOPIA Site Safety CMS moved to its own repo:
https://github.com/xianwenkoh-creator/skytopia-safety
(app: https://xianwenkoh-creator.github.io/skytopia-safety/)

## KKL Document AI (prototype)
`ai/index.html` — a civils.ai-style document workbench in the same single-file style: load
tender/project PDFs, text or CSV files, then run one of five agents — Ask, Check, Extract,
Compare, Takeoff assist. Answers cite pages; a click opens the cited page. Extract, Compare
and Takeoff assist return tables with CSV download. Each run shows tokens and an estimated
cost, and a "Mark checked" step stamps initials before export (same idea as DR Verify).

- Bring your own Anthropic API key (Settings; stored only in that browser). For shared use,
  the Phase 1 service in the blueprint keeps the key on a server.
- Limits per run: 600 pages and about 30 MB of documents. Scanned drawings without a text
  layer are read visually but cannot be page-cited. Measured lengths/areas/volumes are out of
  scope on purpose (counts and schedule reads only).
- Page previews use pdf.js from cdnjs; everything else is in the one file.

## Takeoff engine spikes
`takeoff/` — synthetic drawing with ground truth and three measurement spikes (PyMuPDF, pdf.js,
raster/OpenCV) that back the takeoff system plan. See `takeoff/README.md` for results.

## KKL Earthworks (cut and fill from PDF)
`earthworks/index.html` — the QS's bulk-excavation method as a tool: reads the spot levels off
the topographical survey PDF and snaps each to its marker, reads the E/N grid (or the declared
scale, or a two-click calibration), lets the QS draw excavation zones and set each zone's final
excavation level (typed, picked from the levels found on the design PDF, or derived from a slab
level less deductions), then computes cut and fill per zone by depth band with a colour overlay
for checking, CSV export and a checked-by stamp. `earthworks/engine.js` holds the arithmetic and
is tested with `npm test` against a synthetic sheet with exact volumes (see `earthworks/README.md`).

## Takeoff system plan
- `research/takeoff-system-plan.md` — the plan for reducing QS effort on takeoffs: a calculation
  engine over four measured primitives, capture of the QSs' existing workbooks and markups, staged
  hand-over to the machine with statistical gates, and a first-90-days schedule.
  `research/takeoff.html` is the same as one page.
- Supporting evidence: `takeoff-research-digest.md` (seven research topics), `takeoff-designs.json`
  (five designs), `takeoff-judgements.json` (three judges), `takeoff-verification.json` (three
  sceptics on fourteen claims), `takeoff-open-questions.md` (what only KKL can answer).

## Research
- `research/civils-ai-study.md` — what civils.ai is, sells, charges and (inferred) how it works.
- `research/kkl-ai-blueprint.md` — use cases ranked for KKL, build/buy, the five agents,
  architecture by phase, cost model, confidentiality rules, 12-week pilot plan.
- `research/blueprint.html` — the same, as one shareable page.
