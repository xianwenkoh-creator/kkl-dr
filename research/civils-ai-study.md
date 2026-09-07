# Civils.ai — what it is, what it sells, and how it works

Prepared for KKL (Koh Kock Leong Enterprise Pte Ltd), 3 September 2026.
Companion document: `kkl-ai-blueprint.md` (what KKL should build, and how).

All facts below come from civils.ai's own website, LinkedIn page and blog, plus third-party
profiles (PitchBook, Tracxn, Crunchbase, Cemex Ventures) as of the date above. Where something
is inferred rather than stated, it is marked **(inferred)**.

---

## 1. Snapshot

| | |
|---|---|
| Company | Civils.ai Pte Ltd, Singapore (128 Prinsep St, #01-01) |
| Founded | 2022 (launched January 2022) |
| Founders | Stevan Lukic (CEO, civil engineer, "spent years pulling takeoffs by hand"), Mirko Vairo (COO), Mohamad Fadil (CTO) |
| Team | ~15 people across 4 cities on 3 continents (site); LinkedIn lists fewer. Civil engineers + AI researchers + product builders; ship features biweekly |
| Funding | ~US$1.38M pre-seed (2023) from Atlas SGR, Iterative, Antler, The Gear. Cemex Ventures Top 50 startup |
| Tagline today | "AI Takeoffs & Checks for Earthworks Contractors" / "AI Quantity Takeoffs & Checks for Contractors" |
| Mission | "Automate the manual takeoff and document review work that costs the construction industry billions every year" |
| Traction claimed | 200+ firms in 8 countries; "$3BN+" of construction value; 432,812 tasks automated; 100,000+ boreholes digitised since 2022 |
| Named customers | AECOM, Arup, Jacobs, WSP, Arcadis, Kajima, Penta Ocean (tunnelling/earthworks bidding), Asia Infrastructure Solutions (digital twins), JTC (code compliance and contract checking) |
| Recognition | Gold, Construction Startup Competition 2026 APAC Pitch Day (per LinkedIn, Sept 2026) |

## 2. How the product has moved (2022 → 2026)

Civils.ai has repositioned three times. The sequence matters because it shows what worked and
what did not.

1. **2022 — Geotechnical AI.** Free civil engineering calculators (32 of them) as a funnel, and a
   machine-learning borehole-log digitiser. They used it to read public records and map the
   geology of cities. Target user: geotechnical and tunnel engineers.
2. **2023–24 — "AI for AEC" document platform.** Upload PDF reports, drawings, specs, contracts
   and building codes; search them in plain English; get cited answers; run compliance and
   discrepancy checks; a no-code "workflow builder" with templates for bidding, site
   investigation, contract analysis, compliance tracking and risk management; sub-contractor
   proposal comparison. Big consultancies (AECOM, Arup, WSP) and developer JTC adopted it.
   Pricing at the time was pay-as-you-go from about US$5 per document upload.
3. **2025–26 — Takeoffs and checks for contractors.** The homepage now leads with quantity
   takeoffs measured from PDF drawings by typing the scope in plain English, with every result
   QA-reviewed by their own engineers before delivery, plus the search/check features bundled as
   "unlimited". The earthworks / groundworks contractor is the named target. Cut-and-fill volumes
   are listed as "coming soon".

Reading: the document Q&A layer has become table stakes as frontier models learned to read PDFs
natively, so they moved up the value chain to a measured, verified deliverable (a takeoff) that a
contractor will pay per unit for. Note that this deliverable is **software plus people**: the
product promises results "within 24 hours" with human review, not instant automation.

## 3. Product modules

### 3.1 AI Takeoffs (headline product)
- Input: PDF drawings, "scanned, historic and multi-sheet sets", handwritten included.
- The user types the scope in plain English, e.g. "Measure all asphalt road surfacing and paving
  areas", picks an "AI agent", and runs it.
- Output: quantities landed on an **annotated drawing** (mark-ups on the sheet) plus **Excel** and
  annotated **PDF** exports. Results are editable in the browser before export; Professional plan
  users can "request revisions from comments" and the system "learns your standards".
- Trades covered: floors/roads/landscaping (road surfacing, paving, planting, concrete volume,
  GFA/NFA); utilities/drainage/MEP (pipework by diameter, buried utilities, ducts, cable tray);
  devices and fixtures; foundations/footings/wall runs; facade and formwork elevation areas;
  opening counts and sizes; earthworks (areas, lengths, volumes; cut/fill coming).
- Claims: "over 97% accuracy" on modern PDFs, "90% less manual effort", "most workflows complete
  within 24 hours" with an email when ready. "Every result QA-reviewed by our engineers before
  delivery."
- Unit of sale: 1 takeoff = 1 trade on 1 drawing sheet (up to 1:250 scale); a sheet with several
  trades is capped at 5 takeoffs.

### 3.2 AI Checks (issues and discrepancies)
- Type a QA checklist in plain English; the AI runs every item across unlimited documents and
  flags issues, with citations and mark-ups that "automatically open" at the source.
- Checklists can be saved as reusable templates; "standardise reviews across teams".
- Marketed uses: building-code compliance (they cite Singapore codes and a public library of
  regulatory documents from Singapore agencies), spec-vs-drawing discrepancies, contract risk
  review ("run your specs and contracts through a checklist of queries to find hidden risks and
  requirements"), conflicting requirements between documents.

### 3.3 AI Search and Q&A over the project archive
- Upload or sync (Autodesk Construction Cloud, SharePoint); documents are auto-organised.
- Natural-language search across reports, CAD/PDF drawings and specs; results show source
  documents and highlight the relevant section.
- Vision model reads scanned, handwritten and historic PDFs.
- Positioned as a "learning buddy for new staff onboarding" so junior staff find details alone.

### 3.4 No-code workflows
- Four steps: upload documents → select a workflow template (or make your own) → run → export
  and share. Results go to an "Outputs" tab per project and download as Excel or Word, with
  numbered citations back to source pages.
- Templates named publicly: bidding / tender preparation (extract key clauses and technical
  requirements, find inconsistencies between specifications, standardise bid/no-bid), site
  investigation, contract analysis, compliance tracking, risk management.
- "Multi-step agent workflows" beyond standard searches and checks are priced separately.

### 3.5 Borehole digitiser (geotechnical)
- Upload whole SI reports (scanned or digital, "no file size limits"); extraction takes about
  10 minutes per borehole.
- Extracts 16+ AGS data groups: strata depths and descriptions, SPT and CPT results, groundwater
  observations, lab tests, coordinates and hole metadata.
- Exports AGS 4.1 (for OpenGround, Leapfrog Works), Excel, shapefile and DXF; plots on a site
  map and a 2D/3D ground model; 2D cross-sections for validation.
- Human-in-the-loop review by their engineers before delivery.
- Relevant locally: BCA now requires SI submissions in AGS(SG) electronic format.

### 3.6 Proposal / tender comparison
- Compare sub-contractor proposals like-for-like on cost, schedule, quality and track record
  against customisable criteria; every answer referenced to the source proposal; replaces manual
  Excel comparison tables.

### 3.7 Other pieces
- Geo-referencing: convert construction drawings to GIS data.
- Free calculators (cut and fill, concrete, rebar, haulage; 32 design calculators) and a public
  library of about 1,740 Singapore regulatory documents from 7 agencies (per LinkedIn posts).
- Integrations: Autodesk Construction Cloud and SharePoint sync; API and MCP access, SSO/SAML on
  Enterprise.

## 4. What a job looks like for the user

1. Create a project and drag in PDFs (drawings, specs, reports, contracts).
2. Pick an agent: a takeoff, a check, a search question, or a workflow template.
3. Type the scope or question in plain English (or paste a checklist).
4. Run. Quick questions answer in-app; takeoffs and heavy workflows run asynchronously, pass
   through their QA engineers, and come back within about a day with an email.
5. Review on the annotated drawing or in the results table; click a citation to open the exact
   page; edit; export Excel/PDF/Word; share with the team.

## 5. Pricing and packaging (September 2026, USD)

| Plan | Price | Takeoffs | Searches & checks | Users | Storage | Extras |
|---|---|---|---|---|---|---|
| Starter | $90/month | 10/month | Unlimited (fair use) | 1 | 2 GB | Email support |
| Professional | $270/month | 30/month | Unlimited (fair use) | 1 | 50 GB | Revisions from comments, "learns your standards", priority support |
| Enterprise | Custom, annual | Custom | Unlimited | Unlimited | Custom | API and MCP, SSO/SAML, custom DPA and security review |

Observations:
- Searches and checks are a bundled freebie; **the takeoff is the billable unit**. That is a
  clear statement of where they believe the durable value is.
- At $9 per takeoff on both self-serve plans, with human QA in the loop, margins depend
  on the AI doing most of the work and engineers only reviewing. It is a tech-enabled service.
- No setup fees, cancel anytime; an ROI calculator on the site assumes 5–15 minutes saved per
  prompt.

## 6. Proof points they publish

- JTC (developer), 12 months: 38 users, 2,842 prompts, "528+ hours" saved (about 2.8 months of
  one full-time person), "97% accuracy" on older scanned documents.
- Penta Ocean: automated bidding workflows for tunnelling and earthworks.
- Asia Infrastructure Solutions: data extraction for digital twins.

## 7. Under the hood (inferred)

Civils.ai does not publish its architecture. From the product behaviour, the claims and the
public docs, the pipeline almost certainly looks like this:

1. **Ingestion.** Each PDF page is rasterised and OCR'd; a vision-capable language model reads
   scanned and handwritten pages. Pages, sheets and titles become the unit of citation.
2. **Indexing.** Page text and layout are stored with metadata; a search index (keyword plus
   embeddings) supports the natural-language search and pulls candidate pages for each prompt.
3. **Agents.** Each "agent" or workflow step is a prompt template that receives the relevant
   pages and returns an answer with page citations, or a structured table (Excel/Word). Checklists
   are run item by item. Citations are mapped back to page coordinates so the UI can open and
   highlight the source ("markups").
4. **Takeoffs.** For measurement, vector geometry is extracted from the PDF where available; the
   model classifies and groups elements (this hatch is asphalt, this line is a 300 mm pipe) and
   the platform computes areas, lengths and counts to a scale. Scanned drawings need image
   segmentation. Results are drawn back onto the sheet.
5. **Human QA.** A queue of engineers reviews takeoffs and borehole extractions before release,
   which is why turnaround is "within 24 hours" rather than seconds, and why they can promise 97%.
6. **Platform.** Projects, an Outputs tab, asynchronous jobs with email notification,
   SharePoint/ACC sync, an API and an MCP server for Enterprise.
7. **Data handling (stated).** US-based servers, relational database plus object storage, TLS
   in transit and encryption at rest, documents "anonymised" with un-anonymised access limited to
   the uploading account, delete anytime.

## 8. Strengths, weaknesses, and what their choices tell us

Strengths
- Domain-native: built by civil engineers, with trade-specific takeoff categories, AGS export and
  Singapore codes; credible logos.
- Verified deliverables: the human QA loop turns a probabilistic model into a product contractors
  can rely on for money-bearing quantities.
- Citations everywhere: every answer opens the source page, which is what makes engineers trust it.
- Templates: saved checklists and workflows turn one person's method into the team's standard.

Weaknesses (from KKL's point of view)
- Data leaves Singapore (US servers) and goes to a third party; client confidentiality clauses on
  LTA/HDB/PUB contracts may need to be checked before uploading tender documents.
- Per-seat plans are single-user; team use needs Enterprise pricing.
- Takeoff throughput is capped per seat and gated by their QA queue (24-hour turnaround).
- It knows nothing about KKL's own data: the machine register, daily-report productivity, diesel,
  idle reasons, disposal streams and subcon records that KKL already captures.
- Generic document Q&A is now available from every frontier model with native PDF reading and
  citations; the moat is the takeoff geometry, the QA people and the domain templates.

What their choices tell us
- Document Q&A, checklists, extraction to Excel and cited answers are **cheap to build now**
  (a frontier model reads a 600-page PDF and cites pages out of the box).
- Fully automatic measured takeoffs are **not** reliable enough to ship without human review even
  for a specialist team of 15; cut-and-fill is still "coming soon" after four years.
- The earthworks contractor is a valued customer segment. KKL is exactly that, with more
  in-house data than any civils.ai customer.

## 9. Landscape (for context)

| Tool | Focus | Pricing signal | Notes |
|---|---|---|---|
| Civils.ai (SG) | PDF takeoffs with human QA, checks, search, borehole digitiser | $90–270/user/month + enterprise | Civil/earthworks, Singapore codes |
| Togal.AI (US) | Automatic area/perimeter/count detection on architectural plans | ~$299/user/month | Building trades, estimator-led |
| Kreo (UK) | 2D/3D takeoff and estimating, BIM | ~$35–129/month | QS and developer market |
| Bluebeam Revu | Manual measurement and mark-up standard | Per seat | No AI takeoff; the tool estimators already know |
| Document Crunch (US) | Contract and spec compliance with AI | Enterprise | Contract risk, not drawings |
| Trunk Tools (US) | Q&A agent over project documents for site teams | Enterprise | Search and RFIs |
| Generic LLM workspaces (Claude, Copilot, ChatGPT) | Upload documents, ask questions with citations | ~$25–30/user/month | No trade templates, no takeoff geometry, no workflow outputs |

## 10. What this means for KKL

- The 80% of civils.ai that KKL's engineers, QS and tender team would use daily (ask, check,
  extract, compare, with page citations) can be built in-house on top of a frontier model API,
  in KKL's existing single-file-app style, and pointed at KKL's own documents and data.
- Measured takeoffs from drawings are the hard 20%. Start with count and schedule reads that a
  model does well, keep measured areas and volumes with existing estimating tools (or buy them as
  a service), and add a scaled measurement tool only once the first layer is in daily use.
- KKL's edge is data civils.ai will never have: 1,400+ machines in the register, daily-report
  rows per activity code, soil type and disposal stream, idle reasons, diesel, subcons. "Ask the
  daily reports" is a KKL-only feature and a natural extension of DR Capture and DR Verify.

See `kkl-ai-blueprint.md` for the plan.

## Sources

- https://civils.ai/ (homepage: "AI Takeoffs & Checks for Earthworks Contractors")
- https://civils.ai/pricing
- https://civils.ai/about
- https://civils.ai/ai-for-quantity-takeoffs-estimation
- https://civils.ai/ai-takeoffs-for-earthworks-landscaping-and-subsurface-data
- https://civils.ai/geotechnical-engineering-ai-automation
- https://civils.ai/blog/how-to-extract-data-for-geological-modeling/
- https://civils.ai/ai-for-construction-contractors
- https://civils.ai/ai-for-construction-consultants
- https://civils.ai/construction-contract-ai-automation
- https://civils.ai/construction-tender-ai-automation
- https://civils.ai/blog/how-to-build-no-code-ai-for-construction/
- https://sg.linkedin.com/company/civils-ai
- https://pitchbook.com/profiles/company/506650-51 ; https://tracxn.com/d/companies/civilsai/__enn6AA-pltalgkbBukDZ8xh8yH5SHEUp1Ky49Ox4HnY ; https://www.crunchbase.com/organization/civils-ai
- https://www.cemexventures.com/top-50-startups/civils-ai/
- https://www.aecplustech.com/tools/civils-ai ; https://www.toolbit.ai/ai-tool/civils-ai
- Competitor pricing: https://quotr.ai/blog/best-togal-ai-alternatives-2026/ ; https://www.ruh.ai/blogs/takeoff-tool-comparison-2026
- KKL profile: https://kohkockleong.com/ ; https://equipmenttimes.in/BUILDING-MOMENTUM-WITH-HYSTER:-Koh-Kock-Leong%E2%80%99s-Journey-Toward-Efficiency-and-Growth
