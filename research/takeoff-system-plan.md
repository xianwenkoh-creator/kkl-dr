# KKL Takeoff System — how to reduce QS effort without losing money

Prepared for KKL (Koh Kock Leong Enterprise Pte Ltd), 3 September 2026.

Companion files in this folder: `takeoff-research-digest.md` (seven research topics with sources),
`takeoff-designs.json` (five independent designs), `takeoff-judgements.json` (three judges),
`takeoff-verification.json` (three sceptics on fourteen claims), `takeoff-open-questions.md`
(what only KKL can answer), and the feasibility spikes in `../takeoff/`.

## 1. The answer on one page

**What to build.** A calculation engine, not a drawing-reading robot. KKL's quantities are mostly
arithmetic over four measured primitives (an area, a run length with its attributes, a count with
its attributes, a volume from levels) plus the contract's own measurement rules and the LTA
standard details. Build the engine that turns primitives into BQ lines, claim lines, subcontractor
certificates and variation differentials, keyed to KKL's activity codes and to a per-contract
rulebook that the chief QS confirms clause by clause. Feed it from the files the QSs already
produce (their Excel dims sheets and, where they use it, their Bluebeam markups) rather than from
a new app. Capture every takeoff the QSs do as evidence, run the engine silently beside them, and
hand a family of lines to the machine only when a ledger shows it is safe.

**What not to build yet.** An automatic measurer for vector PDF drawings. The spikes measure a
clean synthetic sheet exactly, but real LTA sheets carry up to 98,000 paths a page, most of them
hatch strokes, with no layers, pen weights that change between editions and pages with no readable
scale. That work is 30 to 40 person-weeks with no guarantee of coverage. In year two, ask every
client and main contractor for DXF (exact quantities, no scale problem), and add an assist overlay
that pre-highlights candidate runs for the QS to accept, gated by a two-day test on ten real sheets.

**Who can build it.** One part-time builder at 0.3 to 0.5 FTE has 8 to 13 person-weeks in six
months. The first six months are therefore the engine, the rulebook, the workbook binder and the
BQ binder, about 12 person-weeks, and nothing else. A second maintainer must be named by month six.

**What it saves.** Say it in capacity, not in a percentage curve nobody can measure: tenders per QS
per month, claim packs per QS per month, days from drawings-in to quantity sheet, omissions caught
before a bid, Superintending Officer queries per claim. The honest year-one expectation is about
10 percent of QS takeoff time, concentrated in derived lines and BQ entry; 30 to 40 percent at
24 months if the derived families graduate and the DXF path lands; the 55 percent some designs
promised is an upside that needs two separate programmes to both reach autonomy.

**What it costs.** Builder time as above; run cost of US$100 to 300 a month; no new licences unless
the QSs already annotate in Bluebeam (then Core seats at US$330 a year each); drone surveys bought
per project only where a bulk site and the contract's payment basis justify them.

**The first two weeks are paper, not code.** Count three live BQs by line and by value; encode
three contracts' preambles by hand with judgement flags; read five NDAs and write a confidentiality
position per client; pull last year's quantity queries and corrections to learn KKL's real error
rate; run a two-week time log per QS; dump the annotations from twenty marked-up PDFs. Under three
person-weeks of QS and contracts time, and every item changes a decision below.

## 2. What the research established

Seven research passes (full digest in `takeoff-research-digest.md`) plus five spikes in `takeoff/`.
The points below are the ones the design turns on.

### 2.1 Where the QS hours go
- Two worlds that automate differently: drawing-based takeoff (tender, VO, final remeasure) and
  site-record measurement (monthly SOPA progress claims, subcon certification, back-charges).
- Drawing takeoff reduces to four primitives: polygon area, polyline length with attributes, count
  with attributes, volume from levels. Roughly 60 percent of KKL's BQ lines (trench excavation by
  depth band, backfill, disposal, bedding, lean, formwork, concrete, asphalt tonnage, kerb haunch)
  are formulas over those primitives plus LTA standard details and the contract preambles.
- Estimated split of QS time (to be replaced by a two-week time log): tender takeoff 35 to 45 percent,
  monthly claims and subcon certification 25 to 30, VOs and claims 10 to 15, ordering and final
  account 10 to 15. Industry accepts 2 to 5 percent variance on detailed bid takeoffs; a 1 percent
  quantity error can move a bid by 8 to 12 percent.
- Progress claims recur monthly on about 30 contracts and are reconciliations of DR Capture rows,
  survey, tickets and delivery orders against provisional BQ items, not drawing measurements.

### 2.2 What the drawings actually contain
- Four input routes in descending value: DXF/DWG (layers, blocks and dimensions give quantities
  directly, no scale needed), vector PDF (exact geometry once scale and class mapping are known),
  scans at 300 dpi or better (about 2 percent), scans below that (not fit for money-bearing use).
- Real LTA standard-detail PDFs tested with the spike code: no layers, black pen weights only
  (0.36, 0.72, 1.08, 1.44, 2.16 pt), 400 to 15,000 paths per A3 sheet, several scales on one sheet,
  some rotated pages with text drawn as outlines and zero extractable words. A scale heuristic from
  dimension strings recovered the declared scale on two of four sheets. Scale must therefore be a
  per-viewport object confirmed by the QS, and classification must key on pen weight and context.
- PyMuPDF extracts 120,000 segments in about 2.4 s and exposes per-path colour, width, dash and
  optional-content layer; pdf.js gives the same data in the browser. ezdxf reads DXF with block counts,
  polyline lengths, hatch areas and true dimension values; DWG needs LibreDWG (GPL) or the ODA
  converter (non-commercial terms to check). Civil 3D objects survive only as proxy graphics; surfaces
  should be requested as LandXML.
- IFC will stay rare for KKL's scope: CORENET X and IFC-SG are building-permit regimes by GFA; LTA
  street works are still A1/A3 drawings; tenders on GeBIZ are PDF and ZIP with no evidence of DWG
  issue. DWG comes only on request from the client or the main contractor's CDE.

### 2.3 What AI can and cannot do on drawings today
- Vision-language models read title blocks, legends, notes and schedules at 0.9 to 0.95 accuracy but
  count symbols poorly: the best model scores 0.51 exact-match on floor-plan counts (AECV-Bench, 2026);
  dimension reading on dense sheets ranges from 80 percent (Gemini 2.5 Pro) to 40 percent (Claude Opus 4).
  Zero-shot extraction from drawings shows recall of 25 to 37 percent with heavy hallucination; a small
  fine-tuned detector beats frontier models by 30 to 50 points.
- Fine-tuned YOLO detectors reach mAP50 of about 82 percent on scanned symbol counting with roughly
  2,000 labelled instances; that is the practical route for scans.
- Every vendor confirms the hybrid: Kreo re-fits AI outlines to the drawing's own lines; Beam AI and
  civils.ai put engineers between the model and the customer; AGTEK says fully automatic earthworks
  takeoff "is currently not realistic". Nobody publishes audited accuracy on civil drawings.
- Rule that follows: a model's number is never a quantity. Models classify, read and cross-check;
  geometry code measures; a QS confirms.

### 2.4 Capturing the daily work without changing it
- Measurements made in Bluebeam Revu, Acrobat, Foxit or PDF-XChange are stored inside the PDF as
  standard annotations with an ISO 32000 scale dictionary and the item subject. A nightly job over the
  tender and claims folders on SharePoint can log sheet, page, scale, geometry, item, author and value
  for every takeoff a QS does. The spike reproduces this exactly. Bluebeam's own CSV export lacks
  geometry, and its API exposes status, not vertices.
- Bluebeam Core or Complete (US$330 to 440 per user per year) is enough; Basics lacks count and volume
  tools. Kreo Pro or Enterprise is the only AI takeoff SaaS returning measurements by API; Togal and
  STACK return quantities only. No surveyed tool ships a Singapore civil method of measurement.

### 2.5 Earthworks volumes and progress measurement
- Volume is a surface-difference problem: average end area over-estimates by 5 to 10 percent; TIN or
  DTM differencing is the accurate method when surfaces are good. LandXML, DXF 3D faces and drone LAS
  parse with open libraries (lxml, ezdxf, PDAL, scipy Delaunay, GDAL).
- RTK drone photogrammetry reaches 1 to 3 cm horizontal and 2 to 5 cm vertical; Singapore vendors
  charge roughly S$1,500 to 10,000 per RTK survey by area with 2 to 3 day turnaround; platforms cost
  about US$4,000 a year; CAAS permits apply. A fortnightly surface agreed with the main contractor can
  replace the manual monthly progress takeoff for bulk excavation and fill.
- Trench and pit excavation is a formula over the plan primitives and the long-section levels
  (the calc spike). LTA M&W defines the material classes that drive disposal; staging grounds charge
  by tonne (Good Earth about S$1.20, Soft Clay about S$5.00, 2022 schedule).
- Truck counts are a cross-check, not a measurement: loads times capacity divided by a bulking factor
  against surveyed bank volume; the residual calibrates KKL's own factors.

### 2.6 Singapore contract realities
- No national method of measurement covers civil works; CEMS and SMM2 are building-only. Rules come
  from each contract's General and Particular Preambles, which PSSCOC Module A makes binding; HDB's SOR
  is reported to follow CESMM. Public-sector civil BQ items are regular in shape: m3 by depth band,
  m by size and depth stage, number by depth, m2 at stated thickness, m3 disposal.
- PSSCOC makes BQ quantities estimates: differences are variations at BQ or analogous rates, and
  provisional quantities are remeasured at completion, so the same item mapping serves tender, claim
  and VO. Client drawings fall under the Official Secrets Act and LTA NDAs; geometry extraction should
  run locally and only non-sensitive text should go to a cloud model unless the client agrees.

### 2.7 How to hand work to a machine safely
- Every domain that automated judgment work converged on the same stages: shadow mode, assist with
  full verification, confidence-gated auto-accept with a random audit, autonomous with audit. Document
  AI ships this as product (Rossum auto-exports above 0.975; AWS adds random sampling to audit the
  model). Medical coding reports automation rate and audited accuracy separately; 95 percent audited
  accuracy is the benchmark; 15 to 20 percent of items staying with humans is normal.
- Independent tests of an AI takeoff tool found counts near perfect and areas systematically
  under-measured, so graduation must be per item class and per drawing source, not per tool.
- Automation bias is large (about 45 percent of errors under AI assistance in one clinical trial) and
  explanations do not fix it; making the reviewer commit before seeing the AI's answer does. Deskilling
  is measurable after months of AI use, so reviewers need unassisted reps and blind audits.
- Sign-off stays with a named QS: the contractor carries the pricing and claim risk.

## 3. Evidence from the spikes and from real sheets

The `takeoff/` folder holds a synthetic 1:500 drainage plan with known quantities and five
measuring routes against it (full results in `takeoff/README.md`).

| Route | Result on the synthetic sheet |
|---|---|
| Vector PDF, PyMuPDF and pdf.js | Every length, count and area exact; scale read from the title block; legend learned automatically; legend and title-block decoys excluded; scale bar cross-check 100.0 m |
| CAD, DXF via ezdxf | Every quantity exact from layers, block inserts and hatches; no scale needed because model space is in metres |
| Simulated scan, OpenCV | 150 dpi: 7 percent length error and a false sump; 300 dpi: within 2 percent and correct counts |
| Calculation layer | 4 lengths, 4 sizes, 8 level pairs and 1 count produce about 20 BQ lines in KKL activity codes |
| Markup capture | Three Revu-style measurement annotations read back exactly with subject, author, geometry, scale and value |

Two first-hand probes of real LTA Standard Details of Road Elements sheets (public PDFs) set the
limits of that evidence:

- 400 to 15,000 paths per A3 page in the first probe, and 26,000 to 98,000 in the kerb chapter,
  of which up to 96,400 are green 0.36 pt hatch strokes. No PDF layers on any file. Linework is
  black, separated only by pen weight (0.36, 0.72, 1.08, 1.44, 2.16 pt).
- The March 2025 re-plot of the same kerb sheets changed pen weights from 0.36 and 0.72 to 0.48
  and 1.08 pt, so a classifier tuned on one edition breaks on the next.
- Several scales on one page (1:20 with 1:30; 1:1000 with 1:50), but the clip hierarchy gives one
  box per page, so viewports cannot be reconstructed from clips alone. Some rotated pages have text
  drawn as outlines and no extractable words, hence no readable scale.
- A crude scale vote from dimension strings recovered the declared scale on the one detail page with
  real text and produced a confident wrong answer on the outline-text pages; ramp gradients such as
  1:12 and a 2009 date read as scales to a naive regex.

Consequences carried into the design: scale is a per-viewport object confirmed by the QS with a
printed-dimension grader as the export block; the automatic vector measurer is an assist, not a
quantity producer, until a real-sheet corpus says otherwise; DXF is the only route to automatic
quantities in the plan's horizon.

## 4. Five candidate designs

Five designers worked independently from the same digest, each from a different starting angle,
and produced complete designs (full text in `takeoff-designs.json`). Three judges then scored them
(`takeoff-judgements.json`). The headline numbers below are the designers' own estimates.

| Design | Angle | Build (person-weeks) | Run (US$/month) | QS effort at 6 / 12 / 24 months (% of today) |
|---|---|---|---|---|
| Rulebook | Calculation-first | 36 | 150 | 90 / 73 / 55 |
| Shadow Ledger | Capture-first | 37 | 450 | 90 / 75 / 55 |
| TrueLine | Vector-first engine | 42 | 250 | 92 / 76 / 62 |
| KKL Takeoff Overlay | In-house civils.ai (model reads, code measures) | 76 | 600 | 88 / 74 / 58 |
| Surface Ledger | Survey-first for progress claims | 42 | 7,500 incl. drone surveys | 95 / 84 / 65 |

- **Rulebook.** Measure or type four primitives once; a versioned, unit-tested rules engine keyed to
  KKL activity codes and a per-contract rulebook (extracted from the BQ preambles and confirmed by
  the chief QS) generates every derived BQ line, claim roll-up, subcon certificate and VO
  differential. Derived lines need no statistical gate, only confirmed rules and golden tests, so
  whole families (trench, chamber, RC section, pavement, kerb) graduate together. Primitives are
  automated last, behind the same interface.
- **Shadow Ledger.** Ship capture before any engine: a nightly job reads the measurement markups in the
  PDFs QSs already save, their Excel workbooks and DR Capture rows into a ledger. The engine runs
  blind against every captured sheet from week six; disagreements are the product for the first six
  months (a second pair of eyes on bids); every correction is a label and a regression case.
- **TrueLine.** One Sheet Geometry Model per page (viewports with confirmed scale, pen-weight classes,
  chained paths, text with direction) fed by PyMuPDF, pdf.js and ezdxf; a classifier trained from QS
  corrections decides what a path is, code decides how much, a rule pack calculates the rest, and a
  QS confirms on an overlay. Scans are traced by the QS with snapping and logged.
- **KKL Takeoff Overlay.** Grow the document-AI workbench into a takeoff product: a vision model reads
  legends, schedules, title blocks and BQ lines but never emits a quantity; geometry code measures;
  a small detector counts symbols on scans; the QS works on an overlay canvas with confidence chips
  and a checked-by stamp; a confidentiality gateway decides per project what may leave the laptop.
- **Surface Ledger.** Attack the recurring work first: monthly claims on about 30 contracts as a
  reconciliation of DR Capture rows, tickets and fortnightly drone or total-station surfaces against
  BQ items, with a joint-measurement pack for the main contractor. Tender takeoff comes second and
  reuses the same item mapping.

What they agree on, which is the strongest signal from the panel:

1. A model's number is never a quantity. Geometry code measures; models classify, read and cross-check.
2. A per-contract rulebook and a KKL item library are the backbone, because no Singapore civil method
   of measurement exists and PSSCOC binds the preambles.
3. The calculation layer over four primitives is where most lines come from, and it graduates by
   confirmed rules and tests rather than by accuracy statistics.
4. Graduation is per item class and per drawing source through shadow, assist, confidence-gated and
   autonomous-with-audit stages, with the thresholds from the research digest.
5. DR Capture rows are the claim-side source; capturing existing markups is the cheapest label source.
6. Scale is per viewport and confirmed by a QS; scans below 300 dpi are not fit for money.

Where they differ is sequencing: which stream delivers the first saved minutes, and how much
product surface to build before the ledger proves anything.

### The judges' scores

Three judges scored every design on six criteria out of 10 (effort reduction, money safety,
feasibility, time to value, cost, fit with KKL), 60 per judge.

| Design | Chief QS | Builder | MD and contracts | Total of 180 |
|---|---|---|---|---|
| Rulebook | 49 | 48 | 48 | 145 |
| Shadow Ledger | 43 | 41 | 39 | 123 |
| TrueLine | 39 | 39 | 41 | 119 |
| Surface Ledger | 33 | 32 | 37 | 102 |
| KKL Takeoff Overlay | 35 | 34 | 32 | 101 |

All three recommended the same merge: the Rulebook as the spine; Shadow Ledger's capture and
evidence layer, including engine proposals written back into the PDF as annotations so a QS reviews
in the tool they already use; TrueLine's real-sheet engineering, provenance per quantity and chainage
ledger, with an honest budget; Surface Ledger's two-source reconciliation for claim lines and its
per-item "paid on" and "measure rule" fields, without its survey-first economics; the Overlay's cost
readout per line, checked-by stamp, confidentiality gateway and a three-month civils.ai trial on
non-confidential sheets as an external benchmark.

Fatal flaws they named: the Overlay's 64 to 76 person-week scope and server components; Surface
Ledger's US$7,500 a month run cost against a year-one saving it put at about 5 percent; Shadow
Ledger's unverified premise that QSs annotate PDFs; TrueLine specifying every module twice.

## 5. Verification: what survived the sceptics

Three sceptics (technical, commercial and legal, practitioner and adoption) each tried to refute
fourteen claims the merged design rests on. Full verdicts with evidence and tests are in
`takeoff-verification.json`. None of the fourteen held cleanly; three were refuted by at least one
lens. The table is in Appendix A. Seven changes to the design follow from it.

1. **Paper before code.** The first two weeks settle the share of formula lines, the shape of real
   preambles, the confidentiality position, KKL's current error rate and the QS time split. Under
   three person-weeks, and each result changes scope.
2. **No separate capture app.** The engine consumes the QS's existing Excel dims sheets and, where
   present, Bluebeam markups, and writes engine-versus-QS columns and BQ codes back. Typed
   primitive tables beside Excel and Bluebeam are double entry, and experienced QSs already hold
   workbooks that do the depth-band arithmetic. The saving is in binding, reconciliation and
   omission-catching, not in retyping.
3. **Rulebook with judgement flags and an exceptions list.** Real civil preambles carry clauses that
   are not parameters (rock measured separately, work adjacent to services, below water table,
   breaking out existing, working space "where necessary"). Each contract's rulebook is parameters
   plus per-line judgement flags the QS sets, plus a cited exceptions list; an un-encodable clause
   leaves its lines in assist rather than blocking the family.
4. **Statistical gates, not "300 clean lines".** Zero errors in 300 lines only bounds the error rate
   at about 1 percent with 95 percent confidence; 600 blind-verified lines bound it at 0.5 percent.
   Errors on derived lines come from inputs and rule interpretation and are correlated within a
   tender, so the unit of evidence is the tender: at least 8 to 10 tenders per family with no
   money-bearing error, plus 600 blind-verified lines, a value cap on auto-accepted lines, and an
   audit that never falls below 5 percent for derived lines. Auto-accept the arithmetic only; every
   input primitive keeps its cross-checks and a human confirmation.
5. **Fix the daily-report schema before promising claims.** DR Capture's depth bands (1.5, 3, 6 m)
   do not align with BQ bands (2, 4, 6 m or 0.25 m stages); pipe size sits in free text; kerb type,
   layer thickness and concrete grade are not fields; chainage is captured only on drainage
   structure rows. Add BQ-item keys first, treat DR rows as progress evidence attached to drawing
   quantities rather than as the quantity, and run claims as a two-contract evidence-binder pilot.
6. **No-cloud by default for client documents.** The Official Secrets Act reaches anyone who
   obtained a document under a government contract; LTA tenders sit behind an NDA and a password;
   main-contractor subcontracts add flow-downs; zero-retention API terms are negotiated, not default.
   Geometry never leaves KKL in any case. Until the contracts manager has read the NDAs and written
   a position per client, rulebooks are typed from per-client templates by the chief QS, and cloud
   text extraction runs only on KKL's own documents.
7. **Gate the automatic measurer behind real sheets.** Two days running the existing extractor
   untuned on ten real consultant plan sheets decides whether the assist overlay is funded; if
   untuned precision is under half, the money goes to a DXF request letter and the DXF fast path.

## 6. The recommended system

### 6.1 Principles

1. A model's number is never a quantity. Geometry code and the rules engine measure and calculate;
   models classify, read and cross-check; a named QS signs.
2. Primitives are measured once; everything derived is code with a version, tests and a citation to
   the rule that produced it.
3. The QS's existing files are the input surface. The engine writes back into them.
4. Every takeoff the QSs do is captured as evidence from week two; the engine runs in shadow against
   it before anyone relies on it.
5. Families graduate on evidence per contract type and drawing source, with structural and
   statistical gates, and fall back on any money-bearing error.
6. Client documents stay local by default; every project carries a confidentiality tier and an
   egress log.

### 6.2 Components and budget

Person-weeks are builder time, corrected by the judges and sceptics rather than the designers'
own estimates. Year one is deliberately the spine only.

| # | Component | What it does | Tech | Origin | Person-weeks |
|---|---|---|---|---|---|
| 1 | Discovery pack | BQ line census by count and value; preamble encoding with judgement flags for three contracts; NDA reading and per-client position; last year's quantity queries as the error baseline; two-week QS time log; annotation dump of twenty marked-up PDFs | Paper, Excel, `extract_markups.py` | Sceptics | 0 (about 3 person-weeks of QS and contracts time) |
| 2 | Item library and rulebook schema | KKL's own civil item taxonomy: trade, code, unit, band set, attributes, inclusions, DR join keys. Rulebook per contract: parameters with value, source page and confirmer; judgement flags per line; cited exceptions list | JSON with schema, versioned in git, edited through a table page | Rulebook, corrected | 1.5 |
| 3 | Rules engine | Pure functions from primitives and rulebook to BQ lines for the trench, chamber, RC-section, pavement and kerb families; golden regression tests including the synthetic truth; continuous integration blocks any golden change | Plain ES module, `node --test`; port of `calc_trench.py` | Rulebook | 3 |
| 4 | Workbook binder | Reads the QS's Excel dims and trench workbooks, runs the engine, writes engine-versus-QS columns, BQ codes and provenance back; flags differences with reason codes | SheetJS in the browser or openpyxl on the office PC | Sceptics, Shadow Ledger | 2.5 |
| 5 | BQ binder | GeBIZ price-schedule PDF to structured BQ lines with page references; classification into the item library by rules first, model only where the tier allows; QS confirms unit and band | PyMuPDF tables; existing workbench Extract preset on cleared documents | Rulebook, Overlay | 2 |
| 6 | Markup harvester | Nightly job over the tender and claims folders: sheet fingerprint, every measurement annotation with page-level viewport scale, value text, custom columns and subject mapped to activity codes. Built only if the discovery pack shows QSs annotate | PyMuPDF and pypdf on the office PC; Bluebeam tool chest keyed to KKL codes | Shadow Ledger | 2 (conditional) |
| 7 | Ledger and scorecard | One row per line: source, engine value, QS final value, checks, reviewer, minutes from file timestamps; weekly disagreements with reason codes; per-family stage status; audit sampling and seeded errors | CSV on SharePoint; a single-file status page in DR Verify style | Shadow Ledger, TrueLine | 2 |
| 8 | VO differential | Two primitive sets (old and new revision) through the same rulebook; omissions and additions listed separately; pricing basis column in the BQ rate, pro-rata, star rate, daywork order | Engine diff mode; `.xlsx` out | Rulebook | 1 |
| 9 | Claims evidence binder (pilot, two contracts) | Attaches DR rows, delivery notes, weighbridge and staging-ground tickets to the QS's own claim lines; flags gaps; two-source reconciliation; back-to-back subcon certificate; audit appendix for SOP Act claims. Requires DR Capture BQ-item keys first | Single-file page over DR CSVs; workbench Extract for KKL's own tickets | Surface Ledger, corrected | 2.5 |
| | **Year one total** | | | | **about 14.5, plus 2 conditional** |
| 10 | DXF fast path and request letter | ezdxf importer mapping layers and blocks to codes per originator; a standard request for DXF, LandXML and TrueType-font PDFs in every tender and subcontract letter | ezdxf; LibreDWG for DWG | TrueLine | 2 |
| 11 | Real-sheet corpus and gate | Thirty real KKL sheets with QS-confirmed quantities; untuned run of the existing extractor; report precision by pen weight, share of pages with readable scale, viewports per page | `extract_pymupdf.py` | Sceptics | 1 |
| 12 | Assist overlay (only if the gate passes) | Pre-highlights candidate runs and symbols on vector PDF; two-click viewport calibration with a printed-dimension grader; snap-to-vector tracing; engine proposals written back as PDF annotations; every trace logged as a label | pdf.js 4.10.38 in the browser; PyMuPDF batch on the office PC | TrueLine, Shadow Ledger | 10 to 14 |
| 13 | Surface volume module (per project) | Baseline, design and periodic as-built surfaces to TIN difference per zone and depth band; used only where a bulk site and the contract's payment basis justify a survey | lxml, ezdxf, PDAL, scipy, numpy | Surface Ledger | 3 |
| | **Year two total** | | | | **16 to 20** |

Scans stay a QS-traced route with logging; symbol detectors and OCR are year three items, or
bought, unless the ledger shows scans are a large share of money-bearing sheets.

### 6.3 How data moves

Tender documents arrive from GeBIZ as PDF and ZIP into the project's SharePoint folder, tagged with
a confidentiality tier at intake. The QS measures as today, in Bluebeam or on the sheet, and enters
primitives in their own workbook. The workbook binder reads that file, runs the engine with the
contract's rulebook, and writes back a second block of columns: engine line, rule applied, source
page, difference, reason. The BQ binder pre-fills the quantity sheet from the price schedule and
the item library. Every night the office PC harvests markups (if any), workbook figures and DR rows
into the ledger. The scorecard shows the chief QS the week's disagreements; adjudications become
labels and regression cases. Claim packs are assembled from the QS's lines with evidence attached,
never generated from DR rows alone. Nothing about a client's drawing leaves KKL; the only outbound
call is text from cleared documents to a cloud model, logged per project.

Repository layout: `takeoff/library/items.json`, `takeoff/rules/<contract>.json` with an
`exceptions` list, `takeoff/engine.js` with `test/golden/`, `takeoff/binder.html`,
`takeoff/bq-binder.html`, `takeoff/harvest.py`, `takeoff/ledger/status.html`, `takeoff/claims.html`;
ledger CSVs and regression sheets on SharePoint, never in the public repository.

### 6.4 Confidentiality tiers

| Tier | Documents | Rule |
|---|---|---|
| T0 | KKL's own: tickets, delivery orders, workbooks, daily reports, internal templates | Cloud text calls allowed under zero-retention terms; geometry local |
| T1 | Client tender and contract documents without an NDA or Official Secrets marking, once the contracts manager has written a position for that client | Text of preambles, BQ lines and schedules may go to a cloud model on a Singapore-resident or zero-retention route; drawings never |
| T2 | NDA-gated tenders, rail and depot work, main-contractor subcontracts with flow-downs | Nothing leaves KKL; rulebook typed from the client template; local rules for BQ classification |

Every project defaults to T2 until the contracts manager changes it in the register.

## 7. How work is handed to the machine

The stages are the same for every family and every drawing source. A family (for example the
trench family on LTA-style contracts, or DR-SUMP counts from DXF) moves up one stage only when the
ledger shows the gate is met, and moves down on any trigger. Thresholds start from the research
digest and were tightened by the sceptics; KKL's own baselines from the discovery pack may move them.

| Stage | What happens | Gate to the next stage |
|---|---|---|
| 0 Instrument | Discovery pack; minutes per family derived from workbook and file timestamps, not from buttons; two QSs blind-measure five sheets and the chief QS adjudicates, scored raw and after interpretation differences are reconciled; money-bearing error defined in writing | Baseline published; error definition signed |
| 1 Shadow | The engine runs against every workbook and marked-up sheet the QSs produce; the QS commits first; differences are logged with reason codes and adjudicated weekly | For derived lines: rulebook confirmed with exceptions listed, golden tests green, three hand-worked runs per contract reproduced. For measured primitives: at least 200 items across 5 projects and 2 sources, median error at most 1 percent (vector or DXF) or 3 percent (scan), 95th percentile at most 5 percent, counts exact on 98 percent, zero confident-wrong |
| 2 Assist | The engine's lines appear beside the QS's own; every line is verified; on a 20 percent sample the QS enters an independent check before the engine's value is shown; every edit is a label and a regression case | At least 8 to 10 tenders per family with no money-bearing error; at least 600 blind-verified lines; accepted without edit at least 95 percent; escaped-error rate at or below KKL's measured baseline |
| 3 Confidence-gated | Derived lines whose inputs passed their cross-checks and whose rules carry no judgement flag are accepted without a second review; everything else queues for review; a 10 percent random audit falls to 5 percent and never lower for derived lines; lines making up the top 80 percent of bid or claim value are always human-checked; a value cap applies per line | Twelve months of clean audits per family |
| 4 Autonomous with audit | As stage 3 with a permanent 5 percent audit, a monthly drift review and a quarterly blind re-baseline; a named QS still signs | Not applicable |

Measured primitives from vector PDF are never confidence-gated on a score. They reach stage 3 only
structurally: DXF sources, or viewports whose scale and legend the QS confirmed by click on that
sheet, with sheet-level audit sampling. Anything from a scan below 300 dpi, any judgement item
(soil-class split, working space, bulking, existing-condition demolition) and any line whose value
depends on a judgement flag stays in assist.

**Money-bearing error.** A difference that changes a bid line, claim, VO or subcontractor payment by
more than the larger of 2 percent of the item value or a fixed sum, proposed at S$2,000 for claims
and payments and S$10,000 for tender line items, to be set against the error baseline from the
discovery pack. Any such error in the auto-accepted stream returns the family to stage 2 until
600 clean lines have passed.

**Rollback and drift.** Any money-bearing error; audit error rate above twice the graduation baseline
over the last 100 items; a new drawing source or client until 50 clean items; any change to code,
rulebook, model or library, which re-runs the regression corpus; a monthly check on edit rates that
acts only when it coincides with an audit accuracy drop.

**Keeping reviewers sharp.** Blind-then-reveal on a sample; seeded known-error lines with each
reviewer's catch rate tracked (target 90 percent); one fully manual sheet per QS per week scored
against the engine; juniors work six months in assist mode with reveal disabled; reviewers are
measured on catch rate, not throughput.

**Ownership.** The chief QS owns the item library, the rulebooks, the graduation decisions and the
incident log, at one day a week for the first three months and half a day thereafter, protected by
the managing director. The builder owns the engine and the regression corpus, with a second
maintainer named by month six. The contracts manager owns the confidentiality register and the
error definition. A named QS signs every bid, claim and certificate because under PSSCOC the
quantities are the contractor's risk. Notify the professional-indemnity insurer in writing of the
assisted process. Report automation rate and audited accuracy separately, per family, every month.

## 8. What a QS's day looks like

**Months 1 to 3.** Nothing changes at the desk. The QS measures and fills the same workbook. Once a
week the chief QS looks at a page of disagreements between the engine and the team's figures and
decides which were right. A few omissions and double counts surface before bids go out. The BQ
binder starts pre-filling the quantity sheet from the price schedule.

**Months 3 to 6.** The workbook comes back from the binder with the engine's lines beside the QS's
own: same run, same levels, the trench family's twenty lines already computed and cited to the
preamble clause. The QS checks, corrects, and stops building those lines by hand. Variation orders
become a diff run. Claims on two pilot contracts arrive as the QS's lines with evidence attached.

**Months 6 to 12.** Derived families whose inputs pass their cross-checks are accepted without a
second look; the QS's time goes to primitives, judgement items and the review queue. New contracts
start with a rulebook drafted from the client template and confirmed clause by clause in an hour.

**Year two.** DXF arrives on more contracts and counts and lengths come out exact. On vector PDFs
the assist overlay pre-highlights runs and the QS accepts them by lasso after calibrating each
viewport with one printed dimension. The QS measures less and reviews more, and the ledger says
how much.

## 9. Roadmap, and what "less QS effort" will mean

| Phase | When | Goal | Stop or go |
|---|---|---|---|
| 0 Discovery | Weeks 0 to 2 | Settle scope on paper: formula share, preamble shape, confidentiality position, error baseline, time split, annotation practice | Go if derived lines are a large minority of value in at least two families and the contracts position allows at least T0 processing |
| 1 Spine | Months 1 to 6 | Item library, rulebooks for three contracts, engine with golden tests, workbook binder, BQ binder, ledger, VO differential; harvester if applicable | Month 3: engine in shadow on two live tenders. Month 6: two families in assist, BQ binder on every new tender, first capacity figures |
| 2 Evidence and claims | Months 6 to 12 | Derived families to stage 3 where gates pass; DR Capture BQ-item keys; claims evidence binder on two contracts; DXF request letter in every tender | Month 9: first family confidence-gated. Month 12: audit results, cash conversion review |
| 3 Measurement assist | Months 12 to 24 | DXF fast path; real-sheet corpus and gate; assist overlay if funded; surface module where justified; second maintainer active | Month 14: corpus gate decides the overlay. Month 18: DXF-sourced counts and lengths at stage 3 where gates pass |

Capacity metrics, reported monthly from file timestamps and the ledger rather than from timers the
QSs press: tenders per QS per month; claim packs per QS per month; days from drawings-in to
quantity sheet; omissions and double counts caught before bid; Superintending Officer and
main-contractor queries per pack; minutes per family per sheet; automation rate and audited
accuracy per family. State up front how saved capacity converts to cash: a deferred hire, or more
tenders bid per month.

Honest expectations, to be replaced by measured figures: about 10 percent of QS takeoff time in
year one, concentrated in derived lines and BQ entry; 30 to 40 percent at 24 months if derived
families graduate and the DXF path lands; 55 percent only if both the drawing and the claims
programmes reach autonomy, which no evidence yet supports. Governance itself costs each QS about
two hours a week and one manual sheet, so month six may show no net saving at all.

## 10. Costs

| Item | Year one | Year two |
|---|---|---|
| Builder time | About 14.5 person-weeks, plus 2 if the harvester applies; fits 0.4 FTE with about 5 person-weeks left for support of the other apps | 16 to 20 person-weeks if the assist overlay is funded; 6 to 8 if it is deferred |
| Chief QS time | One day a week for three months, then half a day | Half a day a week |
| Each QS | About two hours a week of corrections and audits plus one manual sheet | Same |
| Contracts manager | Two days in the discovery pack; an hour per new contract | An hour per new contract |
| Run cost | US$100 to 300 a month of model usage on KKL's own documents; nothing for geometry | Same, plus DXF conversion if DWG needs it |
| Licences | None, unless QSs annotate in Bluebeam: Core at US$330 per user per year | Same |
| Services | civils.ai Starter at US$90 a month for a three-month benchmark on non-confidential sheets | Drone or total-station surveys per project only where justified, S$2,500 to 10,000 per visit |

Treat year one as a capped experiment with stop-loss reviews at months three and six.

## 11. Build, buy, or both

Civils.ai (US$90 to 270 a user a month, human-reviewed takeoffs in 24 hours, US servers) and Kreo
(US$35 to 175 a month, the only affordable tool with a measurement API) sell the part of the problem
this plan defers: measured quantities from drawings. Neither knows KKL's activity codes, contract
preambles, daily-report data or claim cycle, and neither can process NDA-gated documents. Use them
as instruments, not as the system: a three-month civils.ai Starter trial on non-confidential sheets
benchmarks the in-house engine; Kreo Pro is the first thing to try if the corpus gate says the
in-house overlay is not worth building. Bluebeam stays the QS's measuring tool. Re-check the
buy-versus-build position each quarter against the ledger.

## 12. The first 90 days

| Weeks | Action | Owner | Done when |
|---|---|---|---|
| 1 | Tag every line of three live price documents (LTA, HDB, PUB) as formula, primitive, judgement or not measured; report shares by count and by value per family | Chief QS, one day | The share table exists and names the families worth building |
| 1 to 2 | Ask each QS which tool and edition they measure in and where files are saved; collect twenty marked-up PDFs; dump every annotation and page viewport; compare with Bluebeam's own markup list where it exists | Builder, two days | Hit rate for value, scale source and subject reported; harvester go or no-go |
| 1 to 2 | Start a two-week paper time log per QS in five categories; pull last year's quantity queries and corrections and value them | Chief QS, contracts | KKL's own time split and error baseline published |
| 1 to 3 | Read the NDAs and confidentiality clauses of five live contracts; write a one-page position per client; set every project's tier in a register | Contracts manager, two days | Register live; T0 documents identified |
| 2 to 4 | Chief QS and a senior QS independently encode the preambles of the same three contracts into the rulebook template with judgement flags and exceptions; count parameters, un-encodable clauses and disagreements | Chief QS, senior QS, four days | Rulebooks v0 for three contracts; exception lists cited |
| 2 to 4 | Two QSs blind-measure five sheets from one live tender; chief QS adjudicates in one sitting; score raw and reconciled | Two QSs, chief QS | Inter-QS baseline per family |
| 3 to 6 | Item library v0 from the three price documents; engine for the trench and chamber families ported from the spike with golden tests and continuous integration | Builder, chief QS | Three hand-worked runs per contract reproduced to the rounding rule |
| 5 to 8 | Workbook binder v1 reading the QSs' real trench workbooks and writing engine columns back; shadow on two live tenders | Builder, two QSs | Weekly scorecard of disagreements with reason codes in use |
| 6 to 8 | Stopwatch study: one drain run of six to eight sumps, same QS, workbook alone versus workbook plus binder; repeat with a junior | Chief QS | Minutes per family measured, not assumed |
| 8 to 12 | BQ binder v1 on the next live tender; RC-section, pavement and kerb families; VO differential | Builder, chief QS | Quantity sheet pre-filled; first VO diffed |
| 10 to 12 | Add BQ-item keys to DR Capture (pipe size, kerb type, band from depth, layer thickness, grade; chainage or fixed zone on every measured row) | Builder, site engineers | Keys live on two pilot contracts |
| 12 | Stop-loss review: builder hours booked against plan, disagreement trend, first capacity figures, decision on months 4 to 6 | MD, chief QS, builder, contracts | Written go, adjust or stop |

## 13. Risks

| Risk | Mitigation |
|---|---|
| The builder is one person with other apps to keep alive; year one over-commits | Scope cut to the spine; second maintainer named by month six; weekly hours booked against the plan; stop-loss at weeks 12 and 26 |
| Garbage in: a mistyped level or wrong pipe size propagates into twenty lines | Entry cross-checks (invert levels monotonic, depth within band, run totals against the schedule, size against the OD table); the value rule; provenance per line |
| Preamble clauses that no parameter captures | Judgement flags and a cited exceptions list per contract; flagged lines never auto-accept |
| Clients or main contractors object to any cloud processing | T2 by default; geometry always local; rulebooks typed from templates; written position per client before any text leaves |
| QSs do not annotate PDFs, so the harvester has nothing to read | Discovery pack decides; the workbook binder does not depend on it |
| Daily-report rows are not claim-grade | Schema keys first; DR rows as evidence attached to drawing quantities, never the quantity; two-contract pilot |
| Reviewers stop checking | Blind-then-reveal sample; seeded errors with catch rates; one manual sheet a week; audits never below 5 percent on derived lines |
| Real drawings defeat the automatic measurer | It is an assist overlay gated by a real-sheet test; DXF requests in every letter; buy Kreo or civils.ai for measured takeoffs if the gate fails |
| Savings evaporate into busier weeks | Capacity metrics agreed with the MD; cash conversion stated up front |
| Insurance and liability | Named QS signs everything; insurer notified in writing; audit trail per line |

## 14. Questions only KKL can answer

The discovery pack answers the ones that gate the plan: the formula share by value, the shape of
three preambles, the confidentiality position per client, KKL's current error rate, the QS time
split, and whether QSs annotate PDFs. The full list of 54 questions from the research, grouped by
owner, is in `takeoff-open-questions.md`. Five more decide year two: whether main contractors on
MRT subcontracts will release DXF or LandXML; how bulk-excavation claims are agreed today (survey,
loads or theoretical); whether any tippers carry payload weighing; which contracts pay bulk
excavation on survey rather than design-nett; and whether the professional-indemnity insurer
accepts an assisted process with a named sign-off.

## Appendix A. Claims verified

Verdicts from the technical, commercial and legal, and practitioner sceptics. Full reasoning,
evidence and consequences are in `takeoff-verification.json`.

| # | Claim the design rested on | Technical | Commercial | Practitioner | Cheapest test in the first 90 days |
|---|---|---|---|---|---|
| C1 | About 60 percent of BQ lines are formulas over four primitives | weakened | weakened | weakened | Week 1: take the Price Documents of three to five live LTA, HDB and PUB contracts, tag every line in KKL's scope as measured-primitive, derived-by-formula, lookup/schedule, or judgement/sundry, and report the share by count and by value per client. Half a day of chief QS time per BQ. |
| C2 | Preambles reduce to about 40 rulebook parameters with no free-text exceptions | weakened | weakened | weakened | Weeks 3-5: encode the measurement preambles of three live contracts clause by clause into the rulebook schema, marking each clause as parameter, lookup, judgement flag, or un-encodable; count clauses in each bucket and the share of BQ value touched by judgement flags. |
| C3 | Entering primitives takes 30 to 40 percent of the hand time | weakened | weakened | weakened | Stopwatch study on 10 real sheets: for each trench and chamber family, time (a) measuring and level-reading, (b) Excel entry and arithmetic, (c) entry into the capture app; compute primitives-time as a share of today's family time and the double-entry overhead. |
| C4 | Derived lines can auto-accept after rules, tests and 300 clean lines | weakened | refuted | weakened | On the shadow ledger, cluster every engine-vs-QS disagreement by tender x family x root cause (input, rule reading, engine) to measure how correlated errors are; and have a second QS blind-adjudicate 100 randomly sampled 'clean' assist lines to estimate the false-clean rate. |
| C5 | Markups in the QSs' PDFs can be read on real Revu files | weakened | weakened | weakened | Week 1: collect five marked-up PDFs from three QSs (or discover none exist), run the extractor, and compare every recovered value to the Markups List CSV exported from Revu for the same file; count matches within 0.1%. Half a day of builder time once the files are in hand. |
| C6 | Automatic counts and lengths on real layerless sheets within 1 percent, in 15 to 20 person-weeks | weakened | weakened | weakened | Assemble 30 real KKL tender sheets (not LTA standard details), hand-label drain, pipe and kerb runs on five of them, run the spike's signature clustering and report per-path precision and recall by pen weight, the share of pages with extractable scale text, and the number of viewports per page; this fixes coverage and the real budget before any person-week is committed. |
| C7 | Per-viewport scale proposed automatically on 80 percent of viewports | weakened | weakened | weakened | On the 30-sheet real corpus, have a QS list every viewport and its true scale by hand, then run the three voters (title text with gradient and date exclusion, dimension-line detector, scale bar) and report hit rate, confident-wrong rate and no-proposal rate per sheet type (detail, plan, long-section). |
| C8 | DR Capture rows roll up to 80 percent of claimable items, packs within 2 percent | weakened | weakened | weakened | Take the last three certified claim packs on two pilot contracts and, line by line, try to derive each claimed BQ quantity from the DR CSV rows by hand; report the share of lines derivable at all, the share where keys exist but bands or sizes must be inferred, and the quantity gap per derivable line before any calibration. |
| C9 | Local geometry plus text-only cloud calls satisfies OSA and NDAs | weakened | weakened | weakened | Contracts person reads the NDAs and confidentiality clauses of three live LTA/HDB/PUB contracts and one main-contractor subcontract for third-party processing wording, tags all 30 live contracts by tier, and sends one written query to a client asking whether zero-retention API processing of BQ and preamble text is permitted; the answer rate and wording settle the tier split. |
| C10 | One part-time builder ships the spine in six months and auto-primitives in twelve | weakened | refuted | refuted | Log the builder's actual hours on the programme weekly against the M0-M3 plan and record the calendar slip at week 12; in parallel time a full extraction of a 90,000-path sheet in pdf.js on a QS office PC. |
| C11 | QS effort falls to 90, 73 and 55 to 70 percent at 6, 12 and 24 months | weakened | weakened | refuted | Run the per-sheet per-class timer for four weeks before any tool changes anything, then run the shadow tenders with the timer on and report minutes per family; publish the measured hour split so the curve can be rebuilt from data rather than inference. |
| C12 | Two QSs disagree at least as much as the engine's gated error | untestable yet | weakened | weakened | Two-QS blind measurement of 20 sheets with at least 50 items per class, recording geometric disagreement (same item, different number) separately from interpretive disagreement (different scope or rule reading), and reporting the median and 95th percentile per class. |
| C13 | Claims and subcon certification are 25 to 30 percent of QS hours | untestable yet | weakened | weakened | Two-week time log per QS with categories tender takeoff, claim quantity roll-up, claim documentation and negotiation, subcon certification, VO, ordering, other; then compute the share that a roll-up tool could touch. |
| C14 | A check-based confidence proxy reaches 0.5 percent error at 60 percent automation | weakened | untestable yet | weakened | During shadow, log the five check outcomes per item alongside the QS's figure; after 90 days tabulate error rate and item share per check combination, and separately per sheet, to see whether an all-green bucket exists, how large it is, and whether its errors cluster by sheet. |

## Appendix B. Files

| File | Contents |
|---|---|
| `takeoff-research-digest.md` | Seven research topics with findings, sources, implications and open questions, plus the spike evidence and real-sheet analysis |
| `takeoff-designs.json` | Five complete designs: Rulebook, Shadow Ledger, TrueLine, KKL Takeoff Overlay, Surface Ledger |
| `takeoff-judgements.json` | Three judges' scores, rankings, fatal flaws, unsupported claims and grafts |
| `takeoff-verification.json` | Fourteen claims attacked by three sceptics, with tests and consequences |
| `takeoff-open-questions.md` | Fifty-four questions for KKL, grouped by owner |
| `../takeoff/` | Synthetic drawing with truth, five measuring spikes, calculation layer, markup capture, and their README |
| `../ai/index.html` | The document-AI workbench prototype whose Extract preset drafts rulebooks and BQ lines on cleared documents |
