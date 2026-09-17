import { EMOTION_LABELS, topDimensions, type EmotionVector } from "../../engine/dimensions.js";
import { CORE_AXES, formatSigned, type AffectState } from "../../engine/affect.js";
import type { World, CastMember } from "../../engine/world.js";
import type { SessionSnapshot } from "../../engine/session.js";
import type { TranscriptLine } from "../../engine/director-contract.js";

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Array<Node | string | null | undefined>): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}

export function castName(world: World, id: string): string {
  return world.cast.find((c) => c.id === id)?.name ?? id;
}

export function renderMeters(world: World, snap: SessionSnapshot): HTMLElement {
  const box = h("div", { class: "panel" }, h("h3", {}, "The room"));
  for (const id of snap.beat.meters) {
    const spec = world.meters.find((m) => m.id === id);
    if (!spec) continue;
    const v = Math.round(snap.meters[id] ?? spec.start);
    box.append(
      h("div", { class: `meter ${id}`, title: spec.description },
        h("span", {}, spec.label),
        h("div", { class: "bar" }, h("div", { class: "fill", style: `width:${v}%` })),
        h("span", { class: "val" }, String(v)),
      ),
    );
  }
  return box;
}

export function renderRibbon(affect: AffectState): HTMLElement {
  const box = h("div", { class: "panel ribbon" }, h("h3", {}, "How you sounded"));
  if (!affect.latest) {
    box.append(h("div", { class: "empty" }, "Nothing heard yet. The ribbon shows the listener's reading of your last line: what a stranger would hear, not what you meant."));
    return box;
  }
  const dims = h("div", { class: "dims" });
  for (const d of topDimensions(affect.latest, 8)) {
    dims.append(h("div", { class: "dim" }, h("span", {}, d.label), h("div", { class: "bar" }, h("div", { class: "fill", style: `width:${Math.round(d.score * 100)}%` }))));
  }
  box.append(dims);
  const axes = h("div", { class: "axes" });
  for (const spec of CORE_AXES) {
    const v = affect.latestAxes[spec.id] ?? 0;
    const pct = Math.abs(v) * 50;
    const fill = h("div", { class: `fill ${v < 0 ? "neg" : ""}`, style: v >= 0 ? `left:50%;width:${pct}%` : `right:50%;width:${pct}%` });
    axes.append(h("div", { class: "axis", title: spec.description }, h("div", { class: "track" }, fill), h("span", {}, `${spec.label} ${formatSigned(v)}`)));
  }
  box.append(axes);
  return box;
}

export function renderTranscript(world: World, lines: TranscriptLine[], playerRole: string): HTMLElement {
  const box = h("div", { class: "panel" }, h("h3", {}, "Transcript"));
  const list = h("div", { class: "transcript" });
  for (const l of lines) {
    const line = h("div", { class: `line ${l.speaker === playerRole ? "player" : ""}` },
      h("span", { class: "spk" }, `${castName(world, l.speaker)}: `),
      h("span", {}, l.text),
      l.reading ? h("span", { class: "read" }, `you ${l.reading}`) : null,
    );
    list.append(line);
  }
  box.append(list);
  queueMicrotask(() => { list.scrollTop = list.scrollHeight; });
  return box;
}

export function portraitFor(member: CastMember | undefined): string {
  return member?.portrait ?? "/portraits/indigo.svg";
}

export function describeScores(v: EmotionVector): string {
  return topDimensions(v, 3).map((d) => EMOTION_LABELS[d.key].toLowerCase()).join(", ");
}
