/**
 * The Scribe's chart: the story drawn as a road on a stylised aviation chart of the continent.
 *
 * Pure SVG, no dependencies. The world pack supplies the geography (world.chart); this file draws the sheet,
 * lays the road along the beats (following each beat's outcomes to the next), and animates it: the red line
 * draws itself onto the paper, the next portrait and scene appear when it arrives, and where the road forks
 * the branches are shown before the player takes one. Endings are branches to a glyph off the road.
 */
import type { World } from "../engine/world.js";

export type Chart = NonNullable<World["chart"]>;
type Pt = [number, number];
type Waypoint = Chart["waypoints"][number];
type Inset = Chart["insets"][number];
type Ending = Chart["endings"][number];
type Vehicle = Chart["vehicles"][string];
type Beat = World["acts"][number]["beats"][number];
interface Box { x: number; y: number; w: number; h: number }
/** Somewhere the road can go: a waypoint or an ending glyph. */
interface RoadNode { at: Pt; inset?: string | undefined; via?: Pt[] | undefined }
interface Piece { d: string; kind: "inside" | "flight" }
interface Fork { from: string; to: string | null; label: string; outcome: string | null }

export interface ChartOptions {
  /** Portrait URL for a cast id; each waypoint is the player's face at that scene. */
  portrait: (castId: string) => string;
  /** Beat ids in the order they were played; consecutive pairs are drawn as road already travelled. */
  travelled?: string[];
  /** The beat in play, marked with a pulse. Its forks are shown. */
  current?: string | null;
  /** An ending that has fired: its branch is drawn and its glyph lit. */
  ending?: string | null;
  /** The player's flags so far: a waypoint with routes takes the first whose flag is set. */
  flags?: string[];
  /** Waypoints answer clicks with onPick and show a hand on hover. */
  interactive?: boolean;
  onPick?: (beatId: string) => void;
}

export interface ChartHandle {
  el: SVGSVGElement;
  /** Ink the whole road in order, scene by scene, forks included. The opening screen. */
  playAtlas(): Promise<void>;
  /** Draw the leg into a beat from the one before it (or settle on it when the story starts there), then show its forks. */
  playLeg(from: string | null, to: string): Promise<void>;
  /** Draw the branch from a beat to the ending it reached, and light the glyph. */
  playEnding(beat: string, outcome: string): Promise<void>;
  /** Mark a waypoint as the one picked. */
  select(beatId: string | null): void;
  /** Stop every animation; the element may be dropped afterwards. */
  destroy(): void;
}

const NS = "http://www.w3.org/2000/svg";

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...children: Array<Node | string | null | undefined | false>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) if (c) el.append(c);
  return el;
}
const r1 = (n: number): number => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** A steady hash of a point, for hand-drawn jitter that does not change between renders. */
const jitter = (x: number, y: number): number => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };

/** A hand-drawn line through points: a gentle bow for two, a Catmull-Rom curve for more. */
function spline(points: Pt[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [a, b] = points as [Pt, Pt];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(36, len * 0.14);
    const mx = (a[0] + b[0]) / 2 - (dy / len) * bow, my = (a[1] + b[1]) / 2 + (dx / len) * bow;
    return `M ${r1(a[0])} ${r1(a[1])} Q ${r1(mx)} ${r1(my)} ${r1(b[0])} ${r1(b[1])}`;
  }
  const first = points[0]!;
  let d = `M ${r1(first[0])} ${r1(first[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!, p1 = points[i]!, p2 = points[i + 1]!, p3 = points[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

/** Chevrons along a polyline: a mountain range the way old charts drew one. */
function chevrons(points: Pt[], spacing = 13, size = 6.5): string {
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!, [x2, y2] = points[i + 1]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.floor(len / spacing));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      const h = size * (0.7 + 0.6 * jitter(x, y));
      d += ` M ${r1(x - h * 0.9)} ${r1(y + h * 0.5)} L ${r1(x)} ${r1(y - h)} L ${r1(x + h * 0.9)} ${r1(y + h * 0.5)}`;
      d += ` M ${r1(x)} ${r1(y - h)} L ${r1(x + h * 0.35)} ${r1(y - h * 0.1)}`;
    }
  }
  return d;
}

const boxAround = (p: Pt, pad: number): Box => ({ x: p[0] - pad, y: p[1] - pad, w: pad * 2, h: pad * 2 });
const unionBox = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const padBox = (b: Box, pad: number): Box => ({ x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 });

export function renderChart(world: World, opts: ChartOptions): ChartHandle {
  const chart = world.chart;
  if (!chart) throw new Error("This world has no chart");
  const W = chart.width, H = chart.height;
  const uid = `c${Math.random().toString(36).slice(2, 8)}`;
  const insets = new Map<string, Inset>(chart.insets.map((i) => [i.id, i]));
  const wps = new Map<string, Waypoint>(chart.waypoints.map((w) => [w.beat, w]));
  const endings = new Map<string, Ending>(chart.endings.map((e) => [e.outcome, e]));
  const beats: Beat[] = world.acts.flatMap((a) => a.beats);
  const beatById = new Map<string, Beat>(beats.map((b) => [b.id, b]));
  const beatNo = new Map<string, number>(beats.map((b, i) => [b.id, i + 1]));
  /** Chart units per design unit: sizes below were drawn for a 1200-wide sheet and scale with the plate. */
  const U = W / 1200;
  const plate = chart.plate;
  const regions = chart.regions;
  const places = chart.places;
  /** How close the road must pass to a name to discover it, in chart units. */
  const REACH = 90;
  const px = (n: number): string => `${r1(n * U)}px`;
  let destroyed = false;
  let seq = 0;

  // ---------- The road: which beat leads where ----------
  const legs: Array<{ from: string; to: string }> = [];
  const forks = new Map<string, Fork[]>();
  beats.forEach((b, i) => {
    const nextInOrder = beats[i + 1]?.id ?? null;
    const outs = Object.entries(b.outcomes ?? {});
    if (!outs.length) { if (nextInOrder) legs.push({ from: b.id, to: nextInOrder }); return; }
    const dests = new Map<string, string[]>();
    const own: Fork[] = [];
    let mainTo: string | null = null;
    for (const [key, o] of outs) {
      const to = o.next === undefined ? nextInOrder : o.next;
      if (to === null) { own.push({ from: b.id, to: null, label: o.label, outcome: key }); continue; }
      if (!mainTo) mainTo = to;
      dests.set(to, [...(dests.get(to) ?? []), o.label]);
    }
    if (mainTo) legs.push({ from: b.id, to: mainTo });
    for (const [to, labels] of dests) own.unshift({ from: b.id, to, label: labels.join(" / "), outcome: null });
    if (own.length >= 2) forks.set(b.id, own);
  });

  const flagSet = new Set(opts.flags ?? []);
  /** The road into a waypoint can depend on what the player decided: the first route whose flag is set wins, else the plain way. */
  const routeFor = (w: Waypoint) => w.routes.find((r) => flagSet.has(r.flag));
  const viaFor = (w: Waypoint): Pt[] => routeFor(w)?.via ?? w.via;
  const nodeOf = (w: Waypoint): RoadNode => ({ at: w.at, inset: w.inset, via: viaFor(w) });
  /** The road from one node to the next, in pieces: inside an inset, or in flight across the sheet. */
  function legPieces(a: RoadNode, b: RoadNode): Piece[] {
    const ia = a.inset ? insets.get(a.inset) : undefined;
    const ib = b.inset ? insets.get(b.inset) : undefined;
    const via = b.via ?? [];
    if (ia && ib && ia.id === ib.id) return [{ d: spline([a.at, ...via, b.at]), kind: "inside" }];
    const out: Piece[] = [];
    let start: Pt = a.at;
    if (ia) { out.push({ d: spline([a.at, ia.exit]), kind: "inside" }); start = ia.anchor; }
    if (ib) { out.push({ d: spline([start, ...via, ib.anchor]), kind: "flight" }); out.push({ d: spline([ib.exit, b.at]), kind: "inside" }); }
    else out.push({ d: spline([start, ...via, b.at]), kind: "flight" });
    return out;
  }

  // ---------- The sheet ----------
  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": chart.title });
  const defs = s("defs", {},
    s("filter", { id: `${uid}-grain`, x: "0", y: "0", width: "100%", height: "100%" },
      s("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", seed: "7", result: "noise" }),
      s("feColorMatrix", { in: "noise", type: "matrix", values: "0 0 0 0 0.26  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0.09 0" }),
    ),
    s("pattern", { id: `${uid}-forest`, width: 9, height: 9, patternUnits: "userSpaceOnUse" },
      s("circle", { cx: 2.5, cy: 2.5, r: 1.3, fill: "#6f7a4c", "fill-opacity": 0.55 }),
      s("circle", { cx: 6.8, cy: 6.4, r: 1, fill: "#6f7a4c", "fill-opacity": 0.45 }),
    ),
    s("clipPath", { id: `${uid}-clip-l` }, s("circle", { r: 18 * U })),
    s("clipPath", { id: `${uid}-clip-s` }, s("circle", { r: 13 * U })),
    s("radialGradient", { id: `${uid}-vignette`, cx: "50%", cy: "50%", r: "70%" },
      s("stop", { offset: "60%", "stop-color": "#4a3a22", "stop-opacity": 0 }),
      s("stop", { offset: "100%", "stop-color": "#4a3a22", "stop-opacity": 0.22 }),
    ),
  );
  svg.append(defs);

  const gPaper = s("g", { class: "paper" });
  gPaper.append(s("rect", { class: "sea", x: -W, y: -H, width: 3 * W, height: 3 * H }));
  const grid = s("g", { class: "grid" });
  for (let x = -W; x <= 2 * W; x += 100) grid.append(s("line", { x1: x, y1: -H, x2: x, y2: 2 * H }));
  for (let y = -H; y <= 2 * H; y += 100) grid.append(s("line", { x1: -W, y1: y, x2: 2 * W, y2: y }));
  gPaper.append(grid);
  svg.append(gPaper);

  // The artwork: a clean plate, and a lettered plate unmasked region by region as the road reaches them.
  const letterRects = new Map<string, SVGRectElement>();
  if (plate) {
    svg.classList.add("plate");
    const gPlate = s("g", { class: "plate-layers" });
    gPlate.append(s("image", { href: plate.clean, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" }));
    const overlay = plate.letters ?? plate.lettered;
    if (overlay) {
      defs.append(s("filter", { id: `${uid}-soft`, x: "-30%", y: "-30%", width: "160%", height: "160%" }, s("feGaussianBlur", { stdDeviation: 4 * U })));
      const mask = s("mask", { id: `${uid}-letters`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H }, s("rect", { x: 0, y: 0, width: W, height: H, fill: "#000" }));
      for (const rg of chart.regions) {
        if (!rg.box) continue;
        const [bx, by, bw, bh] = rg.box;
        const rect = s("rect", { class: "letter", x: bx, y: by, width: bw, height: bh, fill: "#fff", filter: `url(#${uid}-soft)`, style: `opacity:${rg.reveal ? 0 : 1}` });
        mask.append(rect);
        letterRects.set(rg.id, rect);
      }
      defs.append(mask);
      gPlate.append(s("image", { href: overlay, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none", mask: `url(#${uid}-letters)` }));
    }
    svg.append(gPlate);
  }

  const gLand = s("g", { class: "terrain" },
    s("path", { class: "shore-band", d: chart.land ?? "" }),
    s("path", { class: "land", d: chart.land ?? "" }),
    s("path", { class: "coast", d: chart.land ?? "" }),
  );
  for (const w of chart.waters) {
    gLand.append(s("path", { class: "shore-band", d: w.d }), s("path", { class: "water", d: w.d }));
    if (w.label && w.at) gLand.append(s("text", { class: "wlabel", x: w.at[0], y: w.at[1] }, w.label));
  }
  for (const r of chart.rivers) gLand.append(s("path", { class: "river", d: r.d }));
  for (const f of chart.forests) {
    gLand.append(s("path", { class: "forest", d: f.d, fill: `url(#${uid}-forest)` }));
    if (f.label && f.at) gLand.append(s("text", { class: "flabel", x: f.at[0], y: f.at[1] }, f.label));
  }
  for (const r of chart.ranges) {
    gLand.append(s("path", { class: `range ${r.tone}`, d: chevrons(r.points) }));
    if (r.tone === "frontier") gLand.append(s("path", { class: "frontier", d: `M ${r.points.map((p) => `${p[0]} ${p[1]}`).join(" L ")}` }));
    if (r.label && r.at) {
      gLand.append(s("text", { class: "rlabel", x: r.at[0], y: r.at[1] }, r.label));
      if (r.sub) gLand.append(s("text", { class: "rsub", x: r.at[0], y: r.at[1] + 10 }, r.sub));
    }
  }
  if (!plate) svg.append(gLand);

  const gNames = s("g", { class: "names" });
  const regionEls = new Map<string, SVGGElement>();
  for (const rg of chart.regions) {
    if (rg.box && (plate?.letters || plate?.lettered)) continue; // lettered on the plate, unmasked on arrival
    const g = s("g", { class: `region-label ${rg.reveal ? "hidden" : ""}`, "data-region": rg.id });
    g.append(s("text", { class: `region ${rg.size} ${rg.tone}`, x: rg.at[0], y: rg.at[1], style: `font-size:${px(rg.size === "large" ? 16 : 11)}` }, rg.label));
    if (rg.sub) g.append(s("text", { class: "sub", x: rg.at[0], y: rg.at[1] + 14 * U, style: `font-size:${px(9.5)}` }, rg.sub));
    gNames.append(g);
    regionEls.set(rg.id, g);
  }
  /** Names appear as the road reaches them: lettered plate boxes unmask, drawn labels fade in. */
  const revealed = new Set<string>();
  function revealRegion(id: string): void {
    if (revealed.has(id)) return;
    revealed.add(id);
    regionEls.get(id)?.classList.remove("hidden");
    const rect = letterRects.get(id);
    if (rect) rect.style.opacity = "1";
  }
  function revealPlace(id: string): void {
    if (revealed.has(`place:${id}`)) return;
    revealed.add(`place:${id}`);
    placeEls.get(id)?.classList.remove("hidden");
  }
  function revealRegions(beatId: string): void {
    for (const rg of regions) if (rg.reveal === beatId) revealRegion(rg.id);
    for (const pl of places) if (pl.reveal === beatId) revealPlace(pl.id);
  }
  /** Distance from a point to a box, zero inside it. */
  const boxDistance = (p: Pt, box: [number, number, number, number]): number => {
    const dx = Math.max(box[0] - p[0], 0, p[0] - (box[0] + box[2]));
    const dy = Math.max(box[1] - p[1], 0, p[1] - (box[1] + box[3]));
    return Math.hypot(dx, dy);
  };
  /** The map fills in as the road crosses it: any name within reach of this point is discovered, whether or not anything happens there. */
  function discover(p: Pt): void {
    for (const rg of regions) {
      if (rg.reveal !== "near" || revealed.has(rg.id)) continue;
      const box = rg.box ?? [rg.at[0] - 40, rg.at[1] - 12, 80, 24];
      if (boxDistance(p, box) <= (rg.reach ?? REACH)) revealRegion(rg.id);
    }
    for (const pl of places) {
      if (pl.reveal !== "near" || revealed.has(`place:${pl.id}`)) continue;
      if (Math.hypot(p[0] - pl.at[0], p[1] - pl.at[1]) <= (pl.reach ?? REACH)) revealPlace(pl.id);
    }
  }
  /** Walk a road already travelled and discover what it passed; the path must be in the document. */
  function sweep(path: SVGPathElement): void {
    const L = path.getTotalLength();
    if (!L) return;
    for (let d = 0; d <= L; d += 8 * U) { const q = path.getPointAtLength(d); discover([q.x, q.y]); }
  }
  const GLYPHS: Record<string, string> = {
    palace: "M -7 3 L 7 3 L 6 -1 L 3 -1 L 3 -4 A 3 3 0 0 1 -3 -4 L -3 -1 L -6 -1 Z M -9 7 Q -4 4 0 7 Q 4 10 9 7",
    city: "M -3.5 -3.5 L 3.5 -3.5 L 3.5 3.5 L -3.5 3.5 Z M 0 -3.5 L 0 -6",
    port: "M 0 -5 L 0 5 M -5 1 Q 0 6 5 1 M -3 -3 L 3 -3",
    pass: "M -8 4 L -3 -3 M 3 -3 L 8 4 M 0 2 m -1.2 0 a 1.2 1.2 0 1 0 2.4 0 a 1.2 1.2 0 1 0 -2.4 0",
  };
  const placeEls = new Map<string, SVGGElement>();
  for (const p of chart.places) {
    const g = s("g", { class: `place ${p.glyph} ${p.reveal ? "hidden" : ""}`, "data-place": p.id, transform: `translate(${p.at[0]} ${p.at[1]}) scale(${r1(U)})` },
      s("path", { class: "glyph", d: GLYPHS[p.glyph] ?? GLYPHS.city! }),
      s("text", { x: 12, y: 4 }, p.label),
    );
    gNames.append(g);
    placeEls.set(p.id, g);
  }
  for (const b of chart.beyond) {
    const arrow = b.dir === "n" ? "M 0 -4 L 0 -14 M -4 -10 L 0 -14 L 4 -10" : b.dir === "s" ? "M 0 4 L 0 14 M -4 10 L 0 14 L 4 10" : b.dir === "e" ? "M 4 0 L 14 0 M 10 -4 L 14 0 L 10 4" : "M -4 0 L -14 0 M -10 -4 L -14 0 L -10 4";
    const tx = b.dir === "e" ? -4 : b.dir === "w" ? 4 : 0;
    gNames.append(s("g", { class: "beyond", transform: `translate(${b.at[0]} ${b.at[1]}) scale(${r1(U)})` },
      s("path", { d: arrow }),
      s("text", { x: tx, y: b.dir === "n" ? 8 : b.dir === "s" ? -6 : 3, "text-anchor": b.dir === "e" ? "end" : b.dir === "w" ? "start" : "middle" }, b.label),
    ));
  }
  svg.append(gNames);

  const gInsets = s("g", { class: "insets" });
  for (const ins of chart.insets) {
    const g = s("g", { class: "inset", "data-inset": ins.id });
    g.append(
      s("path", { class: "leader", d: `M ${ins.exit[0]} ${ins.exit[1]} L ${ins.anchor[0]} ${ins.anchor[1]}` }),
      s("circle", { class: "anchor", cx: ins.anchor[0], cy: ins.anchor[1], r: 9 }),
      s("circle", { class: "ring", cx: ins.cx, cy: ins.cy, r: ins.r }),
      s("circle", { class: "ring2", cx: ins.cx, cy: ins.cy, r: ins.r - 5 }),
    );
    ins.plan.forEach((d, i) => g.append(s("path", { class: `plan ${i === 0 ? "fill" : ""}`, d })));
    g.append(s("text", { class: "ititle", x: ins.cx, y: ins.cy - ins.r - 8 * U, style: `font-size:${px(10)}` }, `${ins.title} · inset`));
    gInsets.append(g);
  }
  svg.append(gInsets);

  const gGhost = s("g", { class: "ghost-roads" });
  const gRoad = s("g", { class: "roads" });
  const gForks = s("g", { class: "forks" });
  const gWps = s("g", { class: "waypoints" });
  const vessel = s("g", { class: "vessel hidden" },
    s("path", { class: "hull", d: "M -12 2 Q 0 7 12 2 L 10 -1 L -10 -1 Z" }),
    s("path", { class: "mast", d: "M 0 -1 L 0 -12" }),
    s("path", { class: "sail", d: "M 0 -12 Q 10 -8 7 -1 Z" }),
    s("path", { class: "sail small", d: "M -1 -9 Q -8 -6 -7 -1 Z" }),
  );
  svg.append(gGhost, gRoad, gForks, gWps, vessel);

  // The vehicles that lay the road: a sprite each, with the artwork for the other facing when it has lettering.
  interface Mover { kind: "cutter" | "vehicle"; g: SVGGElement; main: SVGImageElement | null; alt: SVGImageElement | null; faces: "left" | "right"; facing: "left" | "right"; flipStart: number; flipFrom: number; scale: number; x: number; y: number }
  const movers = new Map<string, Mover>();
  const cutterMover: Mover = { kind: "cutter", g: vessel, main: null, alt: null, faces: "right", facing: "right", flipStart: -1, flipFrom: 1, scale: 1, x: 0, y: 0 };
  for (const [key, v] of Object.entries(chart.vehicles) as Array<[string, Vehicle]>) {
    const main = s("image", { href: v.src, x: -v.width / 2, y: -v.height / 2, width: v.width, height: v.height, preserveAspectRatio: "xMidYMid meet" });
    const alt = v.alt ? s("image", { href: v.alt, x: -v.width / 2, y: -v.height / 2, width: v.width, height: v.height, preserveAspectRatio: "xMidYMid meet", style: "display:none" }) : null;
    const g = s("g", { class: "vehicle hidden", "data-vehicle": key }, main, alt);
    movers.set(key, { kind: "vehicle", g, main, alt, faces: v.faces, facing: v.faces, flipStart: -1, flipFrom: 1, scale: 1, x: 0, y: 0 });
    svg.append(g);
  }
  const FLIP_MS = 280;
  /** Place a mover, turning it to face its heading: a sprite with a second artwork swaps at the narrowest point of a squash; one without is mirrored. */
  function placeMover(m: Mover, x: number, y: number, dx: number, dy: number, now: number): void {
    m.x = x; m.y = y;
    if (m.kind === "cutter") {
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      m.g.setAttribute("transform", `translate(${r1(x)} ${r1(y)}) rotate(${r1(deg)}) scale(${r1(U * m.scale)})`);
      return;
    }
    const heading: "left" | "right" | null = dx < -0.3 ? "left" : dx > 0.3 ? "right" : null;
    if (heading && heading !== m.facing) { m.facing = heading; m.flipStart = now; m.flipFrom = m.alt ? 1 : (m.facing === "left" ? 1 : -1) * -1; }
    const mirror = m.alt ? 1 : (m.facing === m.faces ? 1 : -1);
    let sx = mirror;
    if (m.flipStart >= 0) {
      const k = Math.min(1, (now - m.flipStart) / FLIP_MS);
      const width = k < 0.5 ? 1 - 2 * k : 2 * k - 1;
      if (m.alt) {
        const showMain = m.facing === m.faces;
        if (k >= 0.5) { m.main!.style.display = showMain ? "" : "none"; m.alt.style.display = showMain ? "none" : ""; }
        sx = width;
      } else sx = width * (k < 0.5 ? m.flipFrom : mirror);
      if (k >= 1) m.flipStart = -1;
    } else if (m.alt) {
      const showMain = m.facing === m.faces;
      m.main!.style.display = showMain ? "" : "none";
      m.alt.style.display = showMain ? "none" : "";
    }
    m.g.setAttribute("transform", `translate(${r1(x)} ${r1(y)}) scale(${r1(sx * m.scale)} ${r1(m.scale)})`);
  }
  const easeOutBack = (t: number): number => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  /** Grow or shrink a mover in place, fading with it: a take-off springs, a landing shrinks to nothing. */
  function scaleMover(m: Mover, from: number, to: number, ms: number, ease: (t: number) => number = easeInOut, fade?: [number, number]): Promise<void> {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now: number): void => {
        if (destroyed) { resolve(); return; }
        const t = Math.min(1, (now - t0) / ms);
        m.scale = from + (to - from) * ease(t);
        if (fade) m.g.style.opacity = String(r1(fade[0] + (fade[1] - fade[0]) * easeInOut(t)));
        placeMover(m, m.x, m.y, 0, 0, now);
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  const moverFor = (wp: Waypoint, kind: string | null): Mover | null => {
    if (kind !== "flight") return null;
    if (wp.by) return movers.get(wp.by) ?? null;
    return plate ? null : cutterMover;
  };

  // ---------- Furniture: compass, cartouche, scale, grain ----------
  if (chart.compass) {
    const [cx, cy] = chart.compass;
    let d = "";
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const R = i % 2 === 0 ? 30 : 17, w = i % 2 === 0 ? 5 : 3;
      const x = Math.sin(ang) * R, y = -Math.cos(ang) * R;
      const px = Math.sin(ang + Math.PI / 2) * w, py = -Math.cos(ang + Math.PI / 2) * w;
      d += ` M ${r1(x)} ${r1(y)} L ${r1(px)} ${r1(py)} L 0 0 L ${r1(-px)} ${r1(-py)} Z`;
    }
    svg.append(s("g", { class: "compass", transform: `translate(${cx} ${cy})` },
      s("circle", { class: "outer", r: 33 }), s("circle", { class: "inner", r: 24 }),
      s("path", { class: "star", d }), s("text", { class: "n", y: -38, "text-anchor": "middle" }, "N"),
    ));
  }
  if (chart.cartouche) {
    const [x, y] = chart.cartouche;
    svg.append(s("g", { class: "cartouche", transform: `translate(${x} ${y})` },
      s("rect", { width: 232, height: 70, rx: 2 }), s("rect", { class: "inner", x: 4, y: 4, width: 224, height: 62, rx: 1 }),
      s("text", { class: "ctitle", x: 14, y: 26 }, chart.title),
      chart.sheet ? s("text", { class: "csheet", x: 14, y: 41 }, chart.sheet) : null,
      chart.note ? s("text", { class: "cnote", x: 14, y: 54 }, chart.note) : null,
    ));
  }
  if (chart.scale) {
    const { at, px, label } = chart.scale;
    svg.append(s("g", { class: "scale", transform: `translate(${at[0]} ${at[1]})` },
      s("line", { x1: 0, y1: 0, x2: px, y2: 0 }), s("line", { x1: 0, y1: -4, x2: 0, y2: 4 }), s("line", { x1: px / 2, y1: -3, x2: px / 2, y2: 3 }), s("line", { x1: px, y1: -4, x2: px, y2: 4 }),
      s("text", { x: 0, y: -6 }, "0"), s("text", { x: px, y: -6, "text-anchor": "end" }, label),
    ));
  }
  if (!plate) {
    svg.append(s("rect", { class: "vignette", x: 0, y: 0, width: W, height: H, fill: `url(#${uid}-vignette)` }));
    svg.append(s("rect", { class: "grain", x: -W, y: -H, width: 3 * W, height: 3 * H, filter: `url(#${uid}-grain)` }));
  }

  // ---------- Waypoints and endings ----------
  const wpEls = new Map<string, SVGGElement>();
  function waypointEl(wp: Waypoint): SVGGElement {
    const beat = beatById.get(wp.beat);
    if (!beat) throw new Error(`Chart: no beat ${wp.beat}`);
    const inset = wp.inset ? insets.get(wp.inset) : undefined;
    const k = (inset ? 0.72 : 1) * U;
    const r = 18 * k;
    const g = s("g", { class: "wp faint", "data-beat": wp.beat, transform: `translate(${wp.at[0]} ${wp.at[1]})` });
    const body = s("g", { class: "body" },
      s("circle", { class: "halo", r: r + 7 }),
      s("circle", { class: "pulse", r: r + 1 }),
      s("circle", { class: "shadow", r: r + 1.5, cy: 2 }),
      s("image", { href: opts.portrait(beat.playerRole), x: -r, y: -r, width: 2 * r, height: 2 * r, "clip-path": `url(#${uid}-clip-${inset ? "s" : "l"})`, preserveAspectRatio: "xMidYMid slice" }),
      s("circle", { class: "ring", r }),
      s("circle", { class: "badge", cx: r * 0.74, cy: -r * 0.74, r: 7 * k }),
      s("text", { class: "num", x: r * 0.74, y: -r * 0.74 + 2.8 * k, "font-size": 8.5 * k, "text-anchor": "middle" }, String(beatNo.get(wp.beat) ?? "")),
    );
    const title = wp.label ?? beat.title;
    const fs = 11.5 * k, fs2 = 8.6 * k;
    const tw = Math.max(title.length * fs * 0.5, wp.place.length * fs2 * 0.5) + 14 * k;
    const th = 27 * k;
    const side = wp.side ?? (wp.at[0] > W * 0.72 ? "left" : "right");
    const lx = side === "right" ? r + 8 * k : side === "left" ? -(r + 8 * k) - tw : -tw / 2;
    const ly = side === "above" ? -(r + 8 * k) - th : side === "below" ? r + 8 * k : -th / 2;
    const label = s("g", { class: "label" },
      s("rect", { x: lx, y: ly, width: tw, height: th, rx: 3 }),
      s("text", { class: "title", x: lx + 7 * k, y: ly + 11.5 * k, "font-size": fs }, title),
      s("text", { class: "place", x: lx + 7 * k, y: ly + 22.5 * k, "font-size": fs2 }, wp.place),
    );
    g.append(body, label);
    if (opts.interactive) {
      g.classList.add("pick");
      g.addEventListener("click", () => opts.onPick?.(wp.beat));
    }
    return g;
  }
  for (const wp of chart.waypoints) { const el = waypointEl(wp); wpEls.set(wp.beat, el); gWps.append(el); }

  const endingEls = new Map<string, SVGGElement>();
  function endingEl(e: Ending): SVGGElement {
    const g = s("g", { class: `ending ${e.glyph}`, "data-outcome": e.outcome, transform: `translate(${e.at[0]} ${e.at[1]}) scale(${r1(U)})` });
    if (e.glyph === "storm") g.append(s("circle", { class: "mark", r: 9 }), s("path", { class: "bolt", d: "M 1.5 -7 L -4 1 L 0 1 L -1.5 7 L 4 -1 L 0 -1 Z" }));
    else if (e.glyph === "fade") g.append(s("circle", { class: "mark", cx: -7, r: 3 }), s("circle", { class: "mark", cx: 2, r: 2.2 }), s("circle", { class: "mark", cx: 9, r: 1.4 }));
    else g.append(s("circle", { class: "mark", r: 9 }), s("path", { class: "bolt", d: "M -4 0 L 4 0 M 1 -3.5 L 4.5 0 L 1 3.5" }));
    g.append(s("text", { class: "elabel", y: 21, "text-anchor": "middle" }, e.label));
    return g;
  }

  // Forks: per beat, the ghost branches to its endings and a label on every road out of it.
  const forkEls = new Map<string, SVGGElement>();
  const forkLabels: Array<{ text: SVGTextElement; path: SVGPathElement; t: number }> = [];
  /** A fork label: one line per outcome that takes that road. */
  function forkText(label: string, small: boolean): SVGTextElement {
    const text = s("text", { class: `flabel-out ${small ? "small" : ""}`, "text-anchor": "middle", style: `font-size:${px(small ? 5.5 : 9.5)}` });
    const lines = label.split(" / ");
    lines.forEach((line, i) => text.append(s("tspan", { x: 0, dy: i === 0 ? 0 : (small ? 6.5 : 11) * U }, line)));
    return text;
  }
  for (const [beatId, list] of forks) {
    const wp = wps.get(beatId);
    if (!wp) continue;
    const g = s("g", { class: "fork", "data-beat": beatId });
    for (const f of list) {
      if (f.to === null) {
        const e = f.outcome ? endings.get(f.outcome) : undefined;
        if (!e) continue;
        const pieces = legPieces(nodeOf(wp), { at: e.at, inset: e.inset });
        let labelPath: SVGPathElement | null = null;
        for (const p of pieces) { const path = s("path", { class: "branch", d: p.d, style: `stroke-width:${px(1.4)};stroke-dasharray:${r1(2 * U)} ${r1(5 * U)}` }); g.append(path); if (p.kind === "flight" || !labelPath) labelPath = path; }
        const glyph = endingEl(e);
        endingEls.set(e.outcome, glyph);
        g.append(glyph);
        // the cause sits under the glyph's own line (glyph, then what follows, then what led there), clear of the branch
        const text = forkText(f.label, false);
        const fx = r1(e.at[0]), fy = r1(e.at[1] + 33 * U);
        text.setAttribute("x", String(fx));
        text.setAttribute("y", String(fy));
        for (const span of text.querySelectorAll("tspan")) span.setAttribute("x", String(fx));
        g.append(text);
        void labelPath;
      } else {
        const to = wps.get(f.to);
        if (!to) continue;
        const pieces = legPieces(nodeOf(wp), nodeOf(to));
        const flight = pieces.find((p) => p.kind === "flight") ?? pieces[0]!;
        // an invisible copy of the road out, so the label can sit on it; small when the road stays inside an inset
        const path = s("path", { class: "guide", d: flight.d });
        const text = forkText(f.label, flight.kind === "inside");
        g.append(path, text);
        forkLabels.push({ text, path, t: 0.5 });
      }
    }
    forkEls.set(beatId, g);
    gForks.append(g);
  }
  /** Fork labels sit on their roads; the road must be in the document to be measured, so they are placed lazily. */
  function placeForkLabels(): void {
    for (const { text, path, t } of forkLabels) {
      if (text.hasAttribute("x")) continue;
      const L = path.getTotalLength();
      if (!L) continue;
      const p = path.getPointAtLength(L * t);
      const q = path.getPointAtLength(Math.min(L, L * t + 4));
      const nx = -(q.y - p.y), ny = q.x - p.x;
      const n = Math.hypot(nx, ny) || 1;
      const off = (text.classList.contains("small") ? 6 : 10) * U;
      const x = r1(p.x + (nx / n) * off), y = r1(p.y + (ny / n) * off + 3 * U);
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y));
      for (const span of text.querySelectorAll("tspan")) span.setAttribute("x", String(x));
    }
  }

  // Ghost roads: every leg of the road as it will be, dotted.
  const legEls = new Map<string, SVGGElement>();
  for (const leg of legs) {
    const a = wps.get(leg.from), b = wps.get(leg.to);
    if (!a || !b) continue;
    const g = s("g", { class: "leg ghost", "data-from": leg.from, "data-to": leg.to });
    for (const p of legPieces(nodeOf(a), nodeOf(b))) g.append(s("path", { d: p.d, style: `stroke-width:${px(1.5)};stroke-dasharray:${r1(1.5 * U)} ${r1(5 * U)}` }));
    gGhost.append(g);
  }
  // The road past the last scene, dotted: the story goes on beyond this sheet, toward wherever the chart says.
  const last = beats[beats.length - 1];
  const lastWp = last ? wps.get(last.id) : undefined;
  let onwardEl: SVGPathElement | null = null;
  if (lastWp && !lastWp.inset) {
    const [x, y] = lastWp.at;
    const d = chart.onward.length ? spline([lastWp.at, ...chart.onward]) : `M ${x} ${y} Q ${r1(x + 26 * U)} ${r1(y - 30 * U)} ${r1(x + 44 * U)} ${r1(y - 46 * U)}`;
    onwardEl = s("path", { class: "onward", d, style: `stroke-width:${px(1.5)};stroke-dasharray:${r1(1.5 * U)} ${r1(5 * U)}` });
    gGhost.append(onwardEl);
  }
  // Other ways in: a waypoint with routes shows the roads not taken as ghosts at the fork before it, with what would take them.
  for (const w of chart.waypoints) {
    if (!w.routes.length) continue;
    const leg = legs.find((l) => l.to === w.beat);
    const a = leg ? wps.get(leg.from) : undefined;
    if (!leg || !a) continue;
    const chosen = routeFor(w);
    // labels sit late on a detour and early on the plain way, clear of each other and of the endings near the start
    const others: Array<{ via: Pt[]; label: string; t: number }> = w.routes.filter((r) => r !== chosen).map((r) => ({ via: r.via, label: r.label ?? `by way of ${r.flag}`, t: 0.72 }));
    if (chosen) others.unshift({ via: w.via, label: "the plain way", t: 0.3 });
    let g = forkEls.get(leg.from);
    if (!g) { g = s("g", { class: "fork", "data-beat": leg.from }); forkEls.set(leg.from, g); gForks.append(g); }
    for (const alt of others) {
      const pieces = legPieces(nodeOf(a), { at: w.at, inset: w.inset, via: alt.via });
      let labelPath: SVGPathElement | null = null;
      for (const p of pieces) { const path = s("path", { class: "branch alt", d: p.d, style: `stroke-width:${px(1.4)};stroke-dasharray:${r1(2 * U)} ${r1(5 * U)}` }); g.append(path); if (p.kind === "flight" || !labelPath) labelPath = path; }
      const text = forkText(alt.label, false);
      g.append(text);
      if (labelPath) forkLabels.push({ text, path: labelPath, t: alt.t });
    }
  }

  /** A solid leg between two nodes, drawn in pieces; pending pieces stay hidden until revealed. */
  function solidLeg(a: RoadNode, b: RoadNode, key: string, pending: boolean): { g: SVGGElement; pieces: SVGGElement[] } {
    const g = s("g", { class: "leg solid", "data-key": key });
    const pieces: SVGGElement[] = [];
    for (const p of legPieces(a, b)) {
      const piece = s("g", { class: `piece ${pending ? "pending" : ""}`, "data-kind": p.kind },
        plate ? null : s("path", { class: "under", d: p.d }),
        s("path", { class: "dash", d: p.d, style: plate ? `stroke-width:${px(4.2)};stroke-dasharray:${r1(12 * U)} ${r1(7 * U)}` : "" }),
      );
      g.append(piece);
      pieces.push(piece);
    }
    gRoad.append(g);
    return { g, pieces };
  }
  function ensureLeg(from: string, to: string, pending: boolean): SVGGElement[] {
    const key = `${from}>${to}`;
    const existing = legEls.get(key);
    if (existing) return [...existing.querySelectorAll<SVGGElement>("g.piece")];
    const a = wps.get(from), b = wps.get(to);
    if (!a || !b) return [];
    const made = solidLeg(nodeOf(a), nodeOf(b), key, pending);
    legEls.set(key, made.g);
    return made.pieces;
  }

  // ---------- Camera ----------
  let cam: Box = { x: 0, y: 0, w: W, h: H };
  let camRaf = 0;
  const applyCam = (b: Box): void => { cam = b; svg.setAttribute("viewBox", `${r1(b.x)} ${r1(b.y)} ${r1(b.w)} ${r1(b.h)}`); };
  const aspect = (): number => (svg.clientWidth && svg.clientHeight ? svg.clientWidth / svg.clientHeight : W / H);
  /** A box widened to the element's aspect, never smaller than a close look and never wider than the sheet. */
  function fit(b: Box): Box {
    const a = aspect();
    let { x, y, w, h } = b;
    if (w < 220 * U) { x -= (220 * U - w) / 2; w = 220 * U; }
    if (w / h < a) { const nw = h * a; x -= (nw - w) / 2; w = nw; } else { const nh = w / a; y -= (nh - h) / 2; h = nh; }
    const maxW = Math.max(W, H * a);
    if (w > maxW) { const k = maxW / w; const cx = x + w / 2, cy = y + h / 2; w *= k; h *= k; x = cx - w / 2; y = cy - h / 2; }
    // keep the frame on the sheet where it can be: sea past the margin is wasted paper
    if (w <= W) x = clamp(x, 0, W - w); else x = (W - w) / 2;
    if (h <= H) y = clamp(y, 0, H - h); else y = (H - h) / 2;
    return { x, y, w, h };
  }
  const whole = (): Box => fit({ x: 0, y: 0, w: W, h: H });
  function moveCam(target: Box, ms: number): Promise<void> {
    cancelAnimationFrame(camRaf);
    const from = cam;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now: number): void => {
        if (destroyed) { resolve(); return; }
        const t = Math.min(1, (now - t0) / ms);
        const e = easeInOut(t);
        applyCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
        if (t < 1) camRaf = requestAnimationFrame(step); else resolve();
      };
      camRaf = requestAnimationFrame(step);
    });
  }
  const insetBox = (id: string): Box => { const i = insets.get(id)!; return { x: i.cx - i.r * 1.12, y: i.cy - i.r * 1.12, w: i.r * 2.24, h: i.r * 2.24 }; };
  const nodeBox = (n: { at: Pt; inset?: string | undefined }): Box => (n.inset ? insetBox(n.inset) : boxAround(n.at, 60 * U));
  /** Everything a fork can lead to, framed together: the scene, the roads out and where they end. */
  function forkBox(beatId: string): Box | null {
    const list = forks.get(beatId), wp = wps.get(beatId);
    if (!list || !wp) return null;
    let box = nodeBox(wp);
    for (const f of list) {
      if (f.to === null) { const e = f.outcome ? endings.get(f.outcome) : undefined; if (e) box = unionBox(box, boxAround(e.at, 70 * U)); }
      else { const t = wps.get(f.to); if (t) box = unionBox(box, nodeBox(t)); }
    }
    if (wp.inset) box = unionBox(box, boxAround(insets.get(wp.inset)!.anchor, 60 * U));
    return padBox(box, 30 * U);
  }
  const pathBox = (p: SVGPathElement, pad: number): Box => { const b = p.getBBox(); return padBox({ x: b.x, y: b.y, w: b.width, h: b.height }, pad); };

  // ---------- Animation ----------
  /** Reveal one piece of road as if drawn by hand, the vessel flying its length when asked. */
  function revealPiece(piece: SVGGElement, ms: number, mover: Mover | null): Promise<void> {
    const dash = piece.querySelector<SVGPathElement>("path.dash")!;
    const L = dash.getTotalLength();
    const id = `${uid}-m${++seq}`;
    const mp = s("path", { d: dash.getAttribute("d") ?? "", fill: "none", stroke: "#fff", "stroke-width": 14 * U, "stroke-linecap": "round", "stroke-dasharray": String(L), "stroke-dashoffset": String(L) });
    const mask = s("mask", { id, maskUnits: "userSpaceOnUse", x: -W, y: -H, width: 3 * W, height: 3 * H }, mp);
    defs.append(mask);
    piece.setAttribute("mask", `url(#${id})`);
    piece.classList.remove("pending");
    if (mover) mover.g.classList.remove("hidden");
    const t0 = performance.now();
    return new Promise((resolve) => {
      const finish = (): void => { piece.removeAttribute("mask"); mask.remove(); resolve(); };
      const step = (now: number): void => {
        if (destroyed) { finish(); return; }
        const t = Math.min(1, (now - t0) / ms);
        const e = easeInOut(t);
        mp.setAttribute("stroke-dashoffset", String(r1(L * (1 - e))));
        const p = dash.getPointAtLength(L * e);
        if (piece.getAttribute("data-kind") === "flight") discover([p.x, p.y]);
        if (mover) {
          const q = dash.getPointAtLength(Math.min(L, L * e + 4 * U));
          placeMover(mover, p.x, p.y, q.x - p.x, q.y - p.y, now);
        }
        if (t < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
    });
  }
  /** Put a mover at the start of a piece, facing along it, and grow it in: the take-off. */
  async function takeOff(m: Mover, dash: SVGPathElement): Promise<void> {
    const p = dash.getPointAtLength(0), q = dash.getPointAtLength(Math.min(dash.getTotalLength(), 6 * U));
    const heading: "left" | "right" | null = q.x - p.x < -0.3 ? "left" : q.x - p.x > 0.3 ? "right" : null;
    if (heading) m.facing = heading;
    m.flipStart = -1;
    m.scale = 0.12;
    m.g.style.opacity = "0";
    placeMover(m, p.x, p.y, 0, 0, performance.now());
    m.g.classList.remove("hidden");
    await scaleMover(m, 0.12, 1, 560, easeOutBack, [0, 1]);
  }
  /** Shrink a mover where it stands until it is gone: the landing. */
  async function land(m: Mover): Promise<void> {
    await scaleMover(m, 1, 0.1, 640, easeInOut, [1, 0]);
    m.g.classList.add("hidden");
    m.scale = 1;
  }
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  let currentBeat: string | null = null;
  function show(beatId: string, asCurrent: boolean, pop: boolean): void {
    const g = wpEls.get(beatId);
    if (!g) return;
    g.classList.remove("faint");
    revealRegions(beatId);
    if (last && beatId === last.id) onwardEl?.classList.add("shown");
    if (pop) { const body = g.querySelector(".body"); body?.classList.remove("pop"); void (body as SVGGElement | null)?.getBBox(); body?.classList.add("pop"); }
    if (asCurrent) {
      if (currentBeat) wpEls.get(currentBeat)?.classList.remove("current");
      currentBeat = beatId;
      g.classList.add("current");
    }
  }
  function showForks(beatId: string): void {
    const g = forkEls.get(beatId);
    if (!g) return;
    placeForkLabels();
    g.classList.add("shown");
  }
  function fire(outcome: string): void { endingEls.get(outcome)?.classList.add("fired"); }

  async function playLeg(from: string | null, to: string): Promise<void> {
    const b = wps.get(to);
    if (!b) return;
    const a = from ? wps.get(from) : undefined;
    if (!a) {
      applyCam(whole());
      await moveCam(fit(b.inset ? insetBox(b.inset) : boxAround(b.at, 150 * U)), 1300);
      show(to, true, true);
      await revealForks(to);
      return;
    }
    const pieces = ensureLeg(from!, to, true);
    const sameInset = !!a.inset && a.inset === b.inset;
    applyCam(fit(a.inset ? insetBox(a.inset) : boxAround(a.at, 150 * U)));
    let flying: Mover | null = null;
    for (const piece of pieces) {
      const dash = piece.querySelector<SVGPathElement>("path.dash")!;
      const L = dash.getTotalLength();
      const ms = clamp((L / U) * 3.2, 450, 2600);
      const kind = piece.getAttribute("data-kind");
      const mover = moverFor(b, kind);
      if (kind === "flight") void moveCam(fit(pathBox(dash, 120 * U)), ms + (mover ? 420 : 0));
      else if (!sameInset && b.inset && piece === pieces[pieces.length - 1]) void moveCam(fit(insetBox(b.inset)), ms);
      if (mover && mover !== flying) { await takeOff(mover, dash); flying = mover; }
      await revealPiece(piece, ms, mover && L > 40 * U ? mover : null);
    }
    if (flying) await land(flying);
    show(to, true, true);
    await revealForks(to);
  }
  /** Show a beat's forks and pull the camera back until every road out is in view. */
  async function revealForks(beatId: string): Promise<void> {
    if (!forks.has(beatId)) return;
    await wait(350);
    showForks(beatId);
    const box = forkBox(beatId);
    if (box) await moveCam(fit(box), 1100);
    await wait(500);
  }

  async function playEnding(beat: string, outcome: string): Promise<void> {
    const b = wps.get(beat), e = endings.get(outcome);
    if (!b || !e) return;
    show(beat, true, false);
    showForks(beat);
    const { pieces } = solidLeg(nodeOf(b), { at: e.at, inset: e.inset }, `${beat}>${outcome}`, true);
    applyCam(fit(b.inset ? insetBox(b.inset) : boxAround(b.at, 150 * U)));
    for (const piece of pieces) {
      const dash = piece.querySelector<SVGPathElement>("path.dash")!;
      const L = dash.getTotalLength();
      const ms = clamp((L / U) * 3.2, 450, 2200);
      if (piece.getAttribute("data-kind") === "flight") void moveCam(fit(pathBox(dash, 110 * U)), ms);
      await revealPiece(piece, ms, null);
    }
    fire(outcome);
    await wait(300);
  }

  async function playAtlas(): Promise<void> {
    applyCam(whole());
    let prev: string | null = null;
    for (const beat of beats) {
      if (destroyed) return;
      const wp = wps.get(beat.id);
      if (!wp) continue;
      if (prev) {
        const pieces = ensureLeg(prev, beat.id, true);
        let flying: Mover | null = null;
        for (const piece of pieces) {
          const dash = piece.querySelector<SVGPathElement>("path.dash")!;
          const L = dash.getTotalLength();
          const mover = moverFor(wp, piece.getAttribute("data-kind"));
          if (mover && mover !== flying) { await takeOff(mover, dash); flying = mover; }
          await revealPiece(piece, clamp((L / U) * 2.4, 320, 1900), mover && L > 40 * U ? mover : null);
        }
        if (flying) await land(flying);
      }
      show(beat.id, false, true);
      showForks(beat.id);
      await wait(prev ? 140 : 420);
      prev = beat.id;
    }
  }

  // ---------- Initial state ----------
  const travelled = opts.travelled ?? [];
  for (let i = 0; i < travelled.length; i++) {
    const id = travelled[i]!;
    if (i > 0) ensureLeg(travelled[i - 1]!, id, false);
    show(id, false, false);
  }
  if (opts.current) { show(opts.current, true, false); queueMicrotask(() => { if (!destroyed && opts.current) showForks(opts.current); }); }
  // what the road already travelled passed by, once the paths are in the document and can be measured
  if (travelled.length > 1) queueMicrotask(() => { if (destroyed) return; for (const g of legEls.values()) for (const path of g.querySelectorAll<SVGPathElement>('g.piece[data-kind="flight"] path.dash')) sweep(path); });
  if (opts.ending && opts.current) {
    const b = wps.get(opts.current), e = endings.get(opts.ending);
    if (b && e) { solidLeg(nodeOf(b), { at: e.at, inset: e.inset }, `${opts.current}>${opts.ending}`, false); fire(opts.ending); }
  }

  let selected: string | null = null;
  return {
    el: svg,
    playAtlas,
    playLeg,
    playEnding,
    select(beatId) {
      if (selected) wpEls.get(selected)?.classList.remove("selected");
      selected = beatId;
      if (beatId) wpEls.get(beatId)?.classList.add("selected");
    },
    destroy() { destroyed = true; cancelAnimationFrame(camRaf); },
  };
}
