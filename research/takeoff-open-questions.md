# Questions to settle with KKL before Stage 1

Compiled from the seven research topics in `takeoff-research-digest.md`. Each answer changes a design decision in `takeoff-system-plan.md`. Suggested owner in brackets.

## Drawing inputs  [tender team + builder]

- What share of KKL's incoming drawings are (a) vector PDF with real text, (b) vector PDF with outline text, (c) scanned, (d) DXF/DWG, (e) DGN from LTA/MicroStation? A one-week sample from the QS inbox would settle the routing priorities.
- Do main contractors on MRT contracts (e.g. CR108) release DWG/DGN to earthworks subcontractors, and do LTA BIM Requirements for those contracts produce anything KKL could receive (IFC, LandXML surfaces)?
- What are the free-tier monthly caps and current Flex token price for APS Model Derivative under the December 2025 model (only shown in a graphic; retail price last confirmed at US$3 in 2021)?
- Is ODA File Converter usable commercially without ODA membership for an internal tool (ODA FAQ says non-commercial only), or is LibreDWG's read fidelity on R2018 Civil 3D-origin files good enough for KKL's drawings?
- How well does a vision LLM (Claude on the existing document-AI workbench) read rotated dimension strings on 300 dpi renders of the LTA detail sheets compared with PaddleOCR, given the 40 % vs 80 % spread reported between models on mechanical drawings?
- Can dimension-line detection (arrowheads/extension lines from stroked paths) raise per-viewport scale inference from 2/4 to near-100 % on KKL's actual sheets, and how often do sheets carry no usable dimension strings at all (e.g. plan sheets with only chainages)?
- How are levels and chainages drawn on the long-section and cross-section sheets KKL receives (text grids vs graphic profiles), since those, not plan areas, drive excavation and backfill volumes?
- What precision does KKL's estimating and claims process actually require per class (counts exact; lengths within 1 to 2 %; volumes within 5 %?), so that acceptance thresholds and the 'take over' criteria can be set per activity code?

## QS workload  [chief QS]

- What is KKL's actual QS headcount and current hour split between tender takeoff, monthly claims, VOs, subcon certification and ordering? A two-week time log per QS is needed to replace the estimates above.
- Which measurement preambles do KKL's live LTA/HDB/PUB contracts actually use (depth-band sets, whether trench excavation is per m or m3, whether disposal is nett or per load, whether bulk excavation is paid on survey or on design nett)? The Price Documents of two or three live contracts should be extracted to confirm the item structure assumed here.
- How are bulk-excavation claim quantities agreed today on MRT subcontracts — strut-level surveys by KKL, MC's surveyor, or theoretical volumes — and what bulking factor and bin capacity are used to reconcile loads to m3?
- What share of tender drawings arrive as vector PDF vs scanned, and how often are DWG/DXF available from the MC or client (determines how much of the polyline/area automation is usable without raster tracing)?
- Do KKL QSs currently use Bluebeam (Quantity Link to Excel) or measure manually from printed sheets/AutoCAD? This sets the baseline accuracy and the integration path (Bluebeam markup import vs native tool).
- Is rebar priced from an issued BBS at tender or from kg/m3 assumptions, and who prepares the BBS for CIS drains/culverts (client, KKL, or RC subcon)?
- Which soil-class split method is used for disposal pricing at tender (borehole strata by zone, historical DR soil_type ratios, or a blanket %), and how large has the variance between tender and claimed disposal streams been historically?
- Are subcontractor (asphalt, road marking, RC) payments certified on the same quantities as KKL's upstream claim (back-to-back) or on separate site measurements, and which needs the tooling first?
- The PUB Code of Practice PDF could not be fetched (403); the minimum drain/scupper sizes and sump spacing rules relied on secondary summaries and SDRE — confirm against the 7th Edition + Addendum 3 (Apr 2025) before hard-coding lookups.

## AI capability  [builder]

- What is the real mix of DWG/DXF vs vector PDF vs scanned PDF in KKL's incoming tender and construction drawing sets (per client: LTA, HDB, PUB, JTC, main contractors), and can CAD be requested contractually?
- What tolerance do KKL QSs and clients actually apply to each quantity class (m3 excavation, m pipe, m2 asphalt, nr sumps) for claims and VOs, so automation gates can be set in money terms?
- No public dataset or published accuracy exists for civil plan/drainage/road/cross-section drawings; how many historical KKL sheets with confirmed BQ quantities can be assembled as a private benchmark, and how quickly?
- ArchPlanVQA (ASCE JCCE 2026) and the ACM DocEng 2025 floorplan VLM study were not readable; their per-task numbers may refine the VLM capability gradient.
- Togal's three patents were not identified by number; their claims may reveal whether they measure from vector geometry or from raster segmentation.
- MDPI IJGI 2025 contour-vectorisation paper and the IJDAR 2024 construction-symbol detection paper were paywalled/blocked; their DPI-vs-accuracy and mAP tables would sharpen the scan-quality thresholds.
- How well do frontier VLMs handle Singapore-specific conventions (LTA/PUB standard drawings, precast U-drain/sump symbols, top-down excavation staging plans) versus the residential floor plans in every benchmark?
- Cost per sheet: at current API prices, is a tiled multi-crop VLM pass plus a detector cheaper than Civils.ai's $9/takeoff, and does the QS confirmation time fall enough to justify it?

## Tools and capture  [QS team + IT]

- Which tools KKL's QSs actually use today (Bluebeam edition, Acrobat, CostX, Excel-only) and where files are stored (SharePoint library vs file server) — determines the watcher implementation.
- Exact Bluebeam annotation keys for Area/Perimeter/Volume markups (/Vertices, /Measure, /IT, page /VP viewport scale, /OC layer) need verification on one real KKL PDF; only the Line case is documented publicly.
- Whether the Bluebeam Studio/Markups API returns any geometry or only status (the OpenAPI spec URL was not reachable); check the Developer Portal reference after sign-in with a Core+ BBID.
- Cubicost SGD package prices and whether its TAS/TBQ modules cover civil/earthworks items (PSG page returned 403).
- Which method of measurement LTA, PUB and HDB civil contracts reference in their BQ preambles (CESMM-derived or in-house), to fix the target BQ schema.
- Whether QSs also measure in Excel-only workflows (dimensions typed from drawings) with no annotations at all; those takeoffs leave no geometry trail and would need a lightweight capture UI.

## Earthworks and progress  [project managers + survey]

- Which exact method of measurement and BQ preambles KKL's current LTA, HDB, PUB and main-contractor contracts use (CESMM3/4, HK-style CESMM, or bespoke), and what working-space widths and depth bands they specify; read 3–5 live BQs to confirm.
- Current 2025–2026 staging-ground fee schedule and the classification tests (who decides Good Earth vs Soft Clay at the gate) so disposal tonnage can be predicted from SI data.
- How progress volumes are agreed today with main contractors on subcontract packages (e.g. CR108): joint survey by total station, main contractor's surveyor, or load tickets; whether main contractors already fly drones and would accept a shared surface.
- Full-text figures from the MDPI Drones 2026 vegetation/LiDAR earthwork-volume study (403 on fetch) and Propeller's downloadable accuracy report for volume-percentage error rather than point RMSE.
- Whether KKL's tippers or excavators already carry payload weighing (Cat Payload, LOADRITE) or telematics that could give tonnes per load automatically instead of load counts.
- Elevation-label-to-contour association accuracy on real vector PDF topo sheets from Singapore consultants (labels breaking lines, multiple viewports), which the current synthetic spike does not test.
- CAAS controlled-airspace constraints for KKL's actual site locations (Changi, Paya Lebar, Seletar, Tengah zones) and permit lead times, which determine survey frequency in practice.

## Graduation and governance  [chief QS + contracts]

- What is KKL's actual inter-QS measurement variance per class today? Without it the graduation thresholds (1%/3%/5%) are guesses; the two-QS baseline in Stage 0 is the first thing to run.
- What confidence proxy can be validated for deterministic geometry pipelines? Vendors' calibration guidance assumes a probabilistic model; KKL's engine needs an empirically calibrated composite of cross-checks, and its calibration on real (not synthetic) drawings is untested.
- How many money-bearing errors do QSs make today (escaped errors caught by the SO, main contractor or subcon)? This baseline decides whether 0.5% escaped-error rate is stricter or looser than current practice.
- Will LTA, HDB, PUB, JTC and main contractors release DXF/DWG for tender and construction issues, and under what confidentiality terms? Each source type needs its own shadow run.
- How do Singapore PI/CAR insurers and KKL's contracts team view AI-assisted quantities in bids and claims; is a documented human sign-off plus audit trail sufficient?
- Sample-size statistics for graduation: 200-500 items per class is a practical heuristic drawn from medical-coding audit regimes, not a power calculation; a statistician should size N for detecting a 0.5% error rate with acceptable confidence.
- Will the value-based always-check rule (top 80% of value) leave enough auto-accepted volume to deliver measurable effort reduction, or should it be relaxed per class after audits?
- Does blind-then-reveal materially slow QSs in practice, and what fraction of items (20%?) is enough to keep automation bias measurable without eroding the time savings?

## Singapore contracts  [contracts manager]

- What is the exact wording of LTA civil-contract BQ preambles (Measurement and Payment sections) for bulk/under-strut excavation, disposal (in-situ vs lorry-load), backfill and drainage? No public LTA BQ was retrievable; KKL's own tender archive should be mined to confirm item grammar and bands.
- Do LTA, PUB or HDB supply DWG/DXF to tenderers on request, and under what conditions? The public LTA tender page lists only PDF/ZIP; practice must be confirmed with KKL's tender department.
- Is HDB's Standard Schedule of Rates actually 'deemed prepared under CESMM' (which edition), and does KKL price HDB work against the SOR or against project-specific BQs?
- Will IFC+SG extend to infrastructure (IFC 4.3) and will LTA/PUB require IFC deliverables on civil contracts, giving subcontractors model-based quantities? No source confirms this for 2026.
- What is the current SOP Act payment-response period for construction contracts (search snippet says 14 days; 2019 amendments are understood to set 21 days) and what supporting measurement records do LTA/HDB Superintending Officers expect with each claim?
- What do LTA NDAs and main-contractor subcontracts say about third-party processing/cloud storage of drawings, and would a zero-retention API arrangement or a Singapore-hosted deployment satisfy them?
- On CR108-type subcontracts, will the main contractor share IFC/DWG exports from the LTA InSIGHT CDE with KKL, and in what form (federated model, per-discipline DWG, PDF sheets only)?
- Is the GeBIZ price document ever issued as a structured Excel schedule (some contracts show 'Tender Schedule.zip') and, if so, how consistent is its column layout across LTA, HDB and PUB?
