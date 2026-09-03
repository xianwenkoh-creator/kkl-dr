# KKL Earthworks — cut and fill from PDF drawings

The tool does what a QS does by hand for bulk excavation: read the spot levels off the
topographical survey sheet, estimate the existing ground at each point of a grid from the nearby
levels, read the final excavation level for each zone off the design sheets, and work out cut and
fill per zone with depth bands. It runs in the browser from `earthworks/index.html`; the arithmetic
lives in `engine.js`, one module shared with the tests.

## How a QS uses it

1. **Load the topo PDF.** Every number that looks like a level (one to three digits, two or three
   decimals) is picked up and snapped to the survey marker beside it. Numbers with an invert (`IL`),
   chainage (`CH`), height (`H`), or coordinate (`E`, `N`) prefix are left out; manhole covers (`MH`)
   are kept and named. Set the plausible range if the sheet has other decimals in it.
2. **Confirm the scale.** If the sheet carries an E/N coordinate grid with labels, the tool reads it
   and works in real coordinates with no scale at all. Otherwise it reads `SCALE 1:n` from the title
   block, and you should check it with two clicks across a known distance (a grid interval, a
   dimension). Long sections and sheets with several scales need the viewport calibrated.
3. **Clean the levels.** In exclude mode, click any dot that is not ground (kerb top, wall top, tree
   height, cover level you do not want). In add mode, click a point and type a level for scanned or
   hand-written values. Labels can be hidden on dense sheets.
4. **Draw the zones.** Click the corners of each excavation area on the topo sheet; use several
   zones for stepped formation levels. Each zone needs one final excavation level: type it, pick it
   from the list of levels found on the design sheet, or derive it from a slab level less slab,
   blinding and hardcore thicknesses. The note field records where the level came from.
5. **Choose the method and compute.** Surface: proximity (the mean of the nearest K levels within a
   radius, the QS's own method), inverse-distance weighting, or a triangulated surface. Cell 1, 2 or
   5 m; cell level from the mean of four corners or the centre; depth bands as DR Capture
   (1.5 / 3 / 6 m), as the contract (2 / 4 / 6 m) or custom; optional batter allowance shown
   separately. The overlay colours every cell by cut or fill depth so the estimate can be checked
   against the sheet.
6. **Check, stamp, export.** Mark the result checked with initials, export the summary CSV (one
   row per zone with every setting, the scale source, the sheet and the vertices, so the figure can
   be reproduced) and the cells CSV (every cell with ground level, formation level and depth).
   Save the project JSON to reopen the zones and exclusions later; the last state is also kept in
   the browser per file name.

## What the numbers mean

- Quantities are nett with vertical sides, as Singapore preambles measure them. The batter
  allowance is an approximation (edge length times depth squared times slope over two) for pricing,
  not for claiming.
- Cut by band is the volume of each depth layer (0 to 1.5 m, 1.5 to 3 m, and so on); the CSV also
  gives the classification by maximum depth, where a cell's whole volume goes to the band of its
  total depth, because contracts differ on which basis they use.
- Cells whose centre lies inside the zone count in full; with 1 m cells the boundary error is well
  under one percent for any real zone. Cells with no level within the radius are reported as
  missing area rather than guessed.

## Verified on a synthetic sheet

`make_sample_topo.py` writes an A3 1:500 topo sheet with 247 spot levels on a known analytic
surface, an E/N grid, decoy numbers (chainage, dimension, gradient, coordinate, tree height, invert)
and a design sheet with formation levels and notes; the truth file holds exact cut volumes and bands
by fine-grid integration. `npm test` (Node 22, `pdfjs-dist` pinned to 4.10.38) checks that every
level is found and placed on its marker, no decoy leaks, the grid georeference is within 0.5
percent, and cut volumes are within 2 percent of truth for all three surface methods with band sums
consistent. The browser smoke test repeats the volume check through the interface.

## Limits to know

- Scanned sheets have no text: levels must be added by hand, or the sheet OCR'd first.
- Real survey sheets place labels on any side of the marker and sometimes split a level into two
  text runs; the association uses the nearest marker within 14 pt and falls back to the label
  position, so check the dots on a new surveyor's template the first time.
- The existing-ground estimate is only as good as the spot-level density; the tool reports the
  method and radius used, and the difference between proximity and TIN is a useful check.
- Final excavation levels are the QS's reading of the design; the tool lists the levels it finds and
  records the derivation, it does not decide them.
