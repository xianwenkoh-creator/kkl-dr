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

## Research
- `research/civils-ai-study.md` — what civils.ai is, sells, charges and (inferred) how it works.
- `research/kkl-ai-blueprint.md` — use cases ranked for KKL, build/buy, the five agents,
  architecture by phase, cost model, confidentiality rules, 12-week pilot plan.
- `research/blueprint.html` — the same, as one shareable page.
