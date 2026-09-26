import type { WorldInput } from "../../engine/world.js";

/**
 * The Scribe's chart, on Jon's map.
 *
 * The artwork is Jon's inked plate of the continent (1672 x 940): a clean plate under the road, and a lettered
 * plate whose region names are unmasked as the road reaches them, the way his own map animation reveals them.
 * The two plates are separate renders and do not align pixel for pixel, so the names are lifted off the lettered
 * plate into a transparent layer (scripts/chart-letters.ts, from the boxes below) and only that layer is unmasked.
 * The vehicles are Jon's sprites with their backgrounds keyed: the skyship faces left; the wagon has the tour's
 * name on its side, so it comes in both facings. The coordinates below are plate pixels.
 *
 * The road is the player's, drawn section by section as the story moves from one scene to the next, and the
 * sheet stays blank ahead of it (no foreknowledge). The palace scenes are pins on Jon's overview plate of the
 * Sky Palace, bound into the sheet's south-west corner as a panel (his other two plates, the private berth and
 * the dining terrace, are the views shown when those scenes are boarded: the thing is huge, and no one drawing
 * holds it). The road walks between the pins and leaves by the berth; the Humā then flies down to the Congress,
 * which is not in the palace but on the land below, carved out of a mountain; from there the flight goes straight
 * to the Reach when Navid is sent to hire deniables (by way of Omahnd only when the dispatch said Omahnd), lands
 * and fades as the tour wagon grows in its place, and the wagon works east across Covalis toward the border.
 * Names appear as they are crossed. No town on the tour is named but the last.
 */
export const SHADOW_FELL_CHART: NonNullable<WorldInput["chart"]> = {
  width: 1672,
  height: 941,
  title: "The Scribe's Chart",
  sheet: "Ildara, as the ballad tells it",
  plate: { clean: "/chart/plate.webp", lettered: "/chart/plate-lettered.webp", letters: "/chart/letters.webp" },
  vehicles: {
    sky: { src: "/chart/ship.webp", width: 150, height: 98, faces: "left", small: 0.5 },
    road: { src: "/chart/carriage.webp", alt: "/chart/carriage-left.webp", width: 200, height: 102, faces: "right", small: 0.6 },
  },
  // Every name on Jon's lettered plate, with its box. The map fills in as the road crosses it: a name is discovered when
  // the vehicle passes within reach of it, in the air or on the ground, whether or not anything happens there. Halyra is
  // lettered from the start; Mhasun stays under the mask whatever passes.
  regions: [
    { id: "qoranhi", label: "Qoranhi Steppes", at: [236, 148], size: "small", tone: "faint", reveal: "near", box: [158, 112, 156, 72] },
    { id: "concord", label: "Boreal Concord", at: [925, 91], tone: "faint", reveal: "near", box: [798, 68, 254, 46] },
    { id: "covalis", label: "Covalis", at: [890, 182], reveal: "near", reach: 220, box: [805, 157, 171, 51] },
    { id: "mhasun", label: "Mhasun", at: [1427, 114], size: "small", tone: "rival", reveal: "never", box: [1384, 97, 86, 34] },
    { id: "tharcia", label: "Tharcia", at: [1395, 200], tone: "rival", reveal: "near", box: [1312, 173, 167, 54] },
    { id: "morrighad", label: "Morrighad", at: [452, 266], size: "small", reveal: "near", box: [394, 248, 116, 36] },
    { id: "forbidden", label: "The Forbidden Lands", at: [582, 337], reveal: "near", box: [477, 302, 211, 71] },
    { id: "avarand", label: "Avarand", at: [336, 372], reveal: "near", box: [255, 347, 162, 50] },
    { id: "reach", label: "The Reach", at: [865, 360], reveal: "near", reach: 140, box: [745, 333, 241, 54] },
    { id: "inner", label: "The Inner Kingdom", at: [857, 475], reveal: "near", box: [762, 455, 190, 40], lift: "all" },
    { id: "finnegans", label: "Finnegan's Pass", at: [1093, 462], size: "small", reveal: "near", box: [1012, 441, 162, 42] },
    { id: "hundred", label: "The Hundred Kingdoms", at: [586, 525], size: "small", reveal: "near", reach: 130, box: [504, 492, 165, 67] },
    { id: "aelfenwode", label: "Aelfenwöde", at: [1123, 545], reveal: "near", box: [1042, 517, 162, 56] },
    { id: "rhyotish", label: "Rhyotish", at: [753, 578], size: "small", reveal: "near", box: [696, 558, 114, 40] },
    { id: "serpent", label: "Great Eastern Serpent Steppes", at: [1583, 515], size: "small", tone: "faint", reveal: "near", box: [1528, 442, 110, 146] },
    { id: "antiquity", label: "The Elven Antiquity", at: [876, 665], tone: "faint", reveal: "near", reach: 130, box: [698, 637, 356, 57] },
    { id: "morvannon", label: "Morvannon Archipelago", at: [177, 702], size: "small", tone: "faint", reveal: "near", box: [80, 666, 194, 72] },
    { id: "omahnd", label: "Caliphate of Omahnd", at: [656, 768], tone: "rival", reveal: "near", box: [483, 735, 347, 67] },
    { id: "halyra", label: "Sky-Caliphate of Halyra", at: [1243, 776], tone: "home", box: [1066, 748, 354, 56] },
    { id: "xalangi", label: "Xalangi Expanse", at: [1106, 866], size: "small", tone: "faint", reveal: "near", box: [962, 840, 288, 52] },
  ],
  // The Sky Palace: Jon's overview plate (2000 x 858) as a panel in the sheet's corner, pins in sheet units (plate pixel x 0.19,
  // from the panel's corner). The three plates are different angles of one huge structure, so the pins on the overview are placed
  // by inference from the other two: the private berth by the Caliphina's quarters at one end, the Caliph's rooms at the other,
  // the windowless room deep in the hull, the dining terrace under the great dome. Move them freely; nothing else depends on them.
  insets: [{ id: "palace", title: "The Sky Palace of Halyra", shape: "panel", image: "/chart/palace.webp", box: [22, 768, 380, 163], anchor: [1190, 705], exit: [398, 815] }],
  waypoints: [
    { beat: "no-windows", at: [212, 886], inset: "palace", place: "Deep in the hull", side: "left",
      view: { src: "/chart/palace-dining.webp", caption: "The family's dining terrace, under the great dome, where it happened the night before." } },
    { beat: "the-dispatch", at: [322, 822], inset: "palace", place: "The Humā, at the private berth", side: "below",
      view: { src: "/chart/palace-berth.webp", caption: "The private berth at the Caliphina's quarters, the Humā alongside. She keeps the military liaison there by her own choice." } },
    { beat: "the-study", at: [128, 831], inset: "palace", place: "At dawn, on the far side of the complex", side: "above",
      view: { src: "/chart/palace.webp", caption: "The Sky Palace from the causeway; the Humā in flight. The Caliph and the Caliphara keep the far side of the complex." } },
    // The Congress is not in the palace: it sits on the land below, carved out of a mountain. The Humā takes the Caliph down to it.
    { beat: "the-proclamation", at: [1450, 830], place: "The Congress, under the mountain", by: "sky", via: [[1300, 715], [1432, 740]], side: "below" },
    // The flight north: straight to the Reach when Halyra saw through the file; by way of Omahnd when the dispatch said Omahnd.
    { beat: "your-deniables", at: [770, 515], place: "The Hundred Kingdoms, at the Reach's edge", by: "sky", via: [[1470, 745], [1130, 600]], side: "right",
      routes: [{ flag: "omahnd-recommended", label: "by way of Omahnd, if the dispatch said so", via: [[1010, 830], [720, 845], [600, 700], [640, 530]] }] },
    // The tour: from the landing to western Covalis, then north and south across Covalis like a beta wave, working east toward the border.
    { beat: "make-it-famous", at: [596, 236], place: "A tavern in western Covalis", by: "road", via: [[690, 420], [604, 318]], side: "left" },
    { beat: "the-alley", at: [624, 258], label: "The alley", place: "Behind the same tavern", by: "road", side: "below" },
    { beat: "stay-inconspicuous", at: [684, 138], place: "The watch house, the next town north", by: "road", side: "left" },
    { beat: "morning", at: [800, 132], place: "A cottage in the snow", by: "road", via: [[744, 294]], side: "right" },
    { beat: "the-carriage", at: [1010, 126], label: "The carriage", place: "A town square, late in the tour", by: "road", via: [[905, 300]], side: "right" },
  ],
  endings: [
    { outcome: "war", at: [1520, 640], label: "By noon, over the Aegis Peaks", glyph: "storm" },
    { outcome: "named", at: [1560, 760], label: "By nightfall, the Frontier closed", glyph: "withdraw" },
    { outcome: "weak", at: [1340, 905], label: "Three days late, in the tea houses", glyph: "fade" },
  ],
  // Past the last staged scene the road goes on east, to the last kingdom town before the border.
  onward: [[1046, 160], [1050, 212]],
  places: [
    { id: "eronyr", label: "Eronyr", at: [1050, 212], glyph: "city", reveal: "near", reach: 160 },
    // Where it happened: the family's dining terrace, marked on the palace plate from the start.
    { id: "dinner", label: "The dinner", at: [182, 857], glyph: "site", inset: "palace" },
  ],
};
