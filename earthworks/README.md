# KKL Earthworks — cut and fill from PDF drawings

The tool does what a QS does by hand for bulk excavation, for the two kinds of drawing set we get:

- **A topographical survey with spot levels** and a design sheet with formation levels. The tool reads
  the spot levels, estimates the existing ground at each point of a grid from the nearby levels (the
  proximity method), and works out cut and fill per zone with depth bands.
- **An excavation layout plan with formation platforms** (an ERSS layout plan for excavation, for
  example) and its sections. There are no spot levels; the existing ground is a stated level (a
  reclaimed or pre-cut platform), the plan gives each platform's formation level in metres to datum
  (`-12.00m SHD`), and the sections give the batter gradients, berms and construction stages. The
  tool reads the level labels and gradients off the plan, the QS traces the platforms and types the
  slope rules from the sections, and the tool builds the excavated surface and works out the cut by
  platform, by depth band and by stage.

It runs in the browser from `earthworks/index.html`; the arithmetic lives in `engine.js`, one module
shared with the tests. No drawing leaves the machine.

## Workflow A: topo survey and zones

1. **Load the topo PDF.** Every number that looks like a level (one to three digits, two or three
   decimals) is picked up and snapped to the survey marker beside it. Numbers with an invert (`IL`),
   chainage (`CH`), height (`H`), or coordinate (`E`, `N`) prefix are left out; manhole covers (`MH`)
   are kept and named. Set the plausible range if the sheet has other decimals in it.
2. **Confirm the scale.** If the sheet carries an E/N coordinate grid with labels, the tool reads it
   and works in real coordinates with no scale at all. Otherwise it reads `SCALE 1:n` from the title
   block, and you should check it with two clicks across a known distance (a grid interval, a
   dimension, the bar scale). Long sections and sheets with several scales need the viewport calibrated.
3. **Clean the levels.** In exclude mode, click any dot that is not ground (kerb top, wall top, tree
   height, cover level you do not want). In add mode, click a point and type a level for scanned or
   hand-written values. Labels can be hidden on dense sheets.
4. **Draw the zones.** Click the corners of each excavation area on the topo sheet; use several
   zones for stepped formation levels. Each zone needs one final excavation level: type it, pick it
   from the list of levels found on the design sheet, pick it off the sheet itself, or derive it from
   a slab level less slab, blinding and hardcore thicknesses. The note field records where it came from.
5. **Choose the method and compute.** Surface: proximity (the mean of the nearest K levels within a
   radius, the QS's own method), inverse-distance weighting, or a triangulated surface. Cell 0.5 to
   5 m; cell level from the mean of four corners or the centre; depth bands as DR Capture
   (1.5 / 3 / 6 m), as the contract (2 / 4 / 6 m) or custom; optional batter allowance shown
   separately. The overlay colours every cell by cut or fill depth so the estimate can be checked
   against the sheet.

## Workflow B: platform plan and sections

1. **Load the layout plan as the base sheet.** Levels written to datum (`-12.00m SHD`, `+4.0mSHD`,
   `(-15.50m SHD)`) are read with their sign and shown as blue dots where they are written;
   dimensions (`173.6m`, `5m`), SPT values (`N=36`), drawing numbers and section marks are not
   levels. The gradients written on the sheet (`1V:2.5H`, `1H:2V`) are listed. When a sheet's levels
   are all to datum and none sit on survey markers, the tool switches itself to the platform model.
2. **Existing ground.** One level everywhere (the pre-cut platform in the construction sequence, or
   the reclaimed level at the sheetpile line) picked off the sheet or typed; or the spot levels of a
   topo when there is one.
3. **Slope rules, from the sections.** Bottom up, H per 1 V up to a level, the last applying above:
   `1V:1H to -6, 1V:2.5H` means 1:1 in the Old Alluvium below -6 mSHD and 1:2.5 in the fill above.
   Berms as width at level: `3 @ -12, 3 @ -6`. Both notations on the sheets parse (`1H:2V` is
   1V:0.5H). Corners of the batter are mitred (planar faces meeting at outside corners, the QS and
   CAD convention) or rounded.
4. **Stage levels.** Cut-offs for stage volumes, for example `+4, -6, -12`: pre-cut to +4, bulk
   excavation to -6, then to -12, then to formation. The construction sequence on the sections gives
   them.
5. **Trace the platforms.** Draw each platform along the toe of its slopes (the formation outline)
   and give it the formation level written on the plan: type it, pick it off the sheet, or take it
   from the design list. A ramp gets two end levels and two clicks for the ends; the level grades
   between them. A sump or local deepening is a platform inside a platform. A platform retained by a
   wall (the sheetpiled pre-cut over the whole site, for instance) has vertical sides.
6. **Boundary and compute.** Draw the excavation boundary (the contractor boundary or the sheetpile
   line) or let the tool take the platforms plus their slopes. The excavated surface at every cell is
   the lowest of every platform's floor and of the batter rising from its edge under the rules,
   capped by the existing ground; adjacent platforms, sumps and ramps combine on their own, the
   slope between a -12 and a -18 platform comes out of the rules, and nothing is counted twice. The
   result table gives, per platform, the footprint area, the cut within the footprint, the cut on its
   slopes, the total, the depth bands and the stage volumes, with a total row.

## Check, stamp, export (both workflows)

Mark the result checked with initials, export the summary CSV (one row per zone or platform with
every setting, the slope rules, the existing level, the scale source, the sheet and the vertices, so
the figure can be reproduced) and the cells CSV (every cell with existing level, formation or design
level, depth and, for platforms, the governing platform). Save the project JSON to reopen the zones,
platforms, boundary and rules later; the last state is also kept in the browser per file name.

## What the numbers mean

- Zone quantities are nett with vertical sides, as Singapore preambles measure them; the batter
  allowance is an approximation for pricing, not for claiming.
- Platform quantities include the battered sides and berms exactly as the rules describe them, so
  they are what is dug, not a nett figure; the footprint column is the vertical-sided part.
- Cut by band is the volume of each depth layer (0 to 1.5 m, 1.5 to 3 m, and so on); stage volumes
  are the volume between absolute levels. The CSV for zones also gives the classification by maximum
  depth, because contracts differ on which basis they use.
- Cells whose centre lies inside the polygon count in full; with 1 m cells the boundary error is well
  under one percent for any real area. Per-platform attribution of thin features (a 3.6 m sump ring)
  wants 0.5 m cells; totals do not. Cells with no existing level within the radius are reported as
  missing area rather than guessed.

## Verified on synthetic sheets

`make_sample_topo.py` writes an A3 1:500 topo sheet with 247 spot levels on a known analytic
surface, an E/N grid, decoy numbers and a design sheet with formation levels and notes; the truth
file holds exact cut volumes and bands. `make_sample_platforms.py` writes an A1 1:1000 ERSS-style
layout plan (contractor boundary, a sheetpiled pre-cut at +4.00 over a +5.50 platform, platforms at
-12, -18 and -6, a sump at -21.6, a graded ramp, berm and top-of-slope outlines, section marks,
boreholes, gradients, dimensions, a title block with `Scale- 1:1000`) and a truth file computed
independently in numpy on a 0.25 m grid. `npm test` (Node 22, `pdfjs-dist` pinned to 4.10.38)
checks: every spot level found and placed on its marker with no decoy leaking; grid georeference
within 0.5 percent; zone volumes within 2 percent of truth for all three surface methods; every datum
label on the platform plan read with its sign where it is written; a single battered rectangle
within 0.4 percent of the closed-form mitred-offset volume; and the whole sample plan within
0.5 percent of the numpy truth in total, per platform and per stage. The browser smoke tests repeat
both through the interface.

## Limits to know

- Scanned sheets have no text: levels must be added by hand, or the sheet OCR'd first.
- Platform outlines are traced by the QS; the tool does not yet pick the toe lines out of the drawing
  itself (the real sheets carry slope hatching, berm lines and structure outlines in one pen, and
  that separation is the next step once a real sheet has been tested).
- Real survey sheets place labels on any side of the marker and sometimes split a level into two
  text runs; the association uses the nearest marker within 14 pt and falls back to the label
  position, so check the dots on a new surveyor's template the first time.
- The existing-ground estimate from spot levels is only as good as their density; the tool reports
  the method and radius used, and the difference between proximity and TIN is a useful check.
- Formation levels and slope rules are the QS's reading of the drawings; the tool lists what it
  finds and records the derivation, it does not decide them.
