#!/usr/bin/env python3
"""Calculation layer spike: from measured primitives to KKL BQ quantities.

Most earthworks and drainage quantities are calculations over a few measured primitives:
a drain run's length (from the plan), its size (from the label or schedule), and the ground
and invert levels along it (from the long-section or drain schedule). Given those, trench
excavation by depth band, bedding, pipe, backfill and disposal all fall out of rules the
QS already applies by hand. Automating the rules is where most of the hours go, and it needs
no AI at all - only the primitives do.

Usage: python3 calc_trench.py        (uses the sample drawing's drains with synthetic levels)
Rules below are illustrative; a QS sets KKL's own (working space, bedding, batter, OD table).
"""
import json, math, os

RULES = {
    "working_space_m": 0.30,            # each side of the pipe
    "bedding_m": 0.15,                  # granular bed under the pipe
    "surround_m": 0.15,                 # granular surround above pipe crown (Class B / S)
    "depth_bands_m": [1.5, 3.0, 6.0],   # KKL DR Capture bands: <1.5, 1.5-3, 3-6, >6
    "od_mm": {300: 380, 375: 460, 450: 550, 525: 640, 600: 720, 675: 800, 750: 890, 900: 1060, 1050: 1240, 1200: 1400},
    "udrain_outer_mm": {"600x600": (800, 780)},   # width, height of precast unit incl. walls
    "station_m": 0.5,                   # integration step along the run
}
here = os.path.dirname(os.path.abspath(__file__))
truth = json.load(open(os.path.join(here, "sample_drawing.truth.json")))

# Synthetic levels: a QS reads these off the long-section or the drain schedule.
# (GL start, GL end, IL start, IL end) in metres; IL falls at ~1:200 to 1:150.
LEVELS = {"D1": (103.20, 103.05, 101.60, 101.13), "D2": (103.05, 102.90, 101.13, 100.83),
          "D3": (103.40, 102.90, 102.55, 101.90), "D4": (102.90, 102.60, 100.83, 100.31)}

def band_of(depth):
    for i, top in enumerate(RULES["depth_bands_m"]):
        if depth < top: return f"{'<' if i == 0 else str(RULES['depth_bands_m'][i-1]) + '-'}{top}m"
    return f">{RULES['depth_bands_m'][-1]}m"

def run_quantities(run):
    spec = run["spec"]; L = run["length_m"]; gl0, gl1, il0, il1 = LEVELS[run["id"]]
    if "U-drain" in spec:
        size = spec.split()[-1]; w_mm, h_mm = RULES["udrain_outer_mm"][size]
        width = w_mm / 1000 + 2 * RULES["working_space_m"]; unit_h = h_mm / 1000; od = None
        item = ("DR-RCU", f"Precast U-drain {size}", "m")
    else:
        dia = int(spec.split()[0]); od = RULES["od_mm"][dia] / 1000
        width = od + 2 * RULES["working_space_m"]; unit_h = od
        item = ("DR-PIPE", f"RC pipe {dia} dia", "m")
    exc = {}; n = max(1, round(L / RULES["station_m"])); step = L / n
    for k in range(n):
        t = (k + 0.5) / n
        gl = gl0 + (gl1 - gl0) * t; il = il0 + (il1 - il0) * t
        depth = gl - (il - RULES["bedding_m"])                       # formation = invert minus bedding
        band = band_of(gl - il)                                       # band by invert depth, as DR Capture records it
        exc[band] = exc.get(band, 0) + width * depth * step           # vertical sides; add batter for deep runs
    total_exc = sum(exc.values())
    bed = width * RULES["bedding_m"] * L
    if od: pipe_vol = math.pi * (od / 2) ** 2 * L; surround = width * (od + RULES["surround_m"]) * L - pipe_vol
    else:  pipe_vol = (w_mm / 1000) * unit_h * L; surround = 0.0
    backfill = max(0.0, total_exc - bed - surround - pipe_vol)
    return {"id": run["id"], "item": item, "length_m": L, "avg_depth_m": round(((gl0 - il0) + (gl1 - il1)) / 2, 2),
            "trench_width_m": round(width, 2), "exc_by_band_m3": {b: round(v, 1) for b, v in exc.items()},
            "exc_total_m3": round(total_exc, 1), "bedding_surround_m3": round(bed + surround, 1), "backfill_m3": round(backfill, 1)}

rows = [run_quantities(d) for d in truth["drains"]]
# roll up to KKL activity codes the way the BQ and the daily report are structured
bq = {}
def add(code, desc, unit, qty): k = (code, desc, unit); bq[k] = bq.get(k, 0) + qty
for r in rows:
    add(*r["item"], r["length_m"])
    for band, v in r["exc_by_band_m3"].items(): add("EW-EXCT", f"Trench excavation, depth {band}", "m3", v)
    add("EW-BF", "Backfilling incl. compaction", "m3", r["backfill_m3"])
    add("EW-HARD", "Granular bedding and surround", "m3", r["bedding_surround_m3"])
    add("EW-DISP", "Disposal offsite (excavated less backfill)", "m3", r["exc_total_m3"] - r["backfill_m3"])
add("DR-SUMP", "Sump / manhole (precast)", "no", truth["sump_count"])

print("MEASURED PRIMITIVES -> DERIVED QUANTITIES")
for r in rows:
    print(f"  {r['id']} {r['item'][1]:22} L={r['length_m']:7.2f} m  avg depth {r['avg_depth_m']:.2f} m  trench w {r['trench_width_m']:.2f} m  exc {r['exc_total_m3']:7.1f} m3 {r['exc_by_band_m3']}")
print("\nBQ / ACTIVITY-CODE ROLL-UP")
for (code, desc, unit), qty in sorted(bq.items()):
    print(f"  {code:8} {desc:48} {qty:9.1f} {unit}")
json.dump({"runs": rows, "bq": [{"code": c, "desc": d, "unit": u, "qty": round(q, 1)} for (c, d, u), q in bq.items()]},
          open(os.path.join(here, "sample_drawing.quantities.json"), "w"), indent=1)
print("\nEvery number above came from 4 lengths, 4 sizes, 8 level pairs and a count: 25 primitives, ~20 BQ lines.")
