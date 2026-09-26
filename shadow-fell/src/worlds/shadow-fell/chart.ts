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
 * The route follows the one Jon drew: west from Halyra along the southern coast through Omahnd, north through
 * the Elven Antiquity to the Hundred Kingdoms and the Inner Kingdom, where the skyship lands; then by carriage
 * north-west through the Forbidden Lands and north-east to Covalis. The story's stops sit on it: the hire where
 * the ship lands, the tour along the carriage road. No town on the tour is named; the four palace scenes sit in
 * a magnified inset of the Sky Palace in the south-eastern sea.
 */
export const SHADOW_FELL_CHART: NonNullable<WorldInput["chart"]> = {
  width: 1672,
  height: 941,
  title: "The Scribe's Chart",
  sheet: "Ildara, as the ballad tells it",
  plate: { clean: "/chart/plate.webp", lettered: "/chart/plate-lettered.webp", letters: "/chart/letters.webp" },
  vehicles: {
    sky: { src: "/chart/ship.webp", width: 150, height: 98, faces: "left" },
    road: { src: "/chart/carriage.webp", alt: "/chart/carriage-left.webp", width: 200, height: 102, faces: "right" },
  },
  // Every name on Jon's lettered plate, with its box. The road reveals the ones it reaches, as his animation does;
  // "never" keeps a name under the mask for the whole story. Halyra is lettered from the start.
  regions: [
    { id: "qoranhi", label: "Qoranhi Steppes", at: [236, 148], size: "small", tone: "faint", reveal: "never", box: [158, 112, 156, 72] },
    { id: "concord", label: "Boreal Concord", at: [925, 91], tone: "faint", reveal: "never", box: [798, 68, 254, 46] },
    { id: "covalis", label: "Covalis", at: [890, 182], reveal: "the-carriage", box: [805, 157, 171, 51] },
    { id: "mhasun", label: "Mhasun", at: [1427, 114], size: "small", tone: "rival", reveal: "never", box: [1384, 97, 86, 34] },
    { id: "tharcia", label: "Tharcia", at: [1395, 200], tone: "rival", reveal: "never", box: [1312, 173, 167, 54] },
    { id: "morrighad", label: "Morrighad", at: [452, 266], size: "small", reveal: "make-it-famous", box: [394, 248, 116, 36] },
    { id: "forbidden", label: "The Forbidden Lands", at: [582, 337], reveal: "make-it-famous", box: [477, 302, 211, 71] },
    { id: "avarand", label: "Avarand", at: [336, 372], reveal: "make-it-famous", box: [255, 347, 162, 50] },
    { id: "reach", label: "The Reach", at: [865, 360], reveal: "make-it-famous", box: [745, 333, 241, 54] },
    { id: "inner", label: "The Inner Kingdom", at: [857, 475], reveal: "your-deniables", box: [762, 455, 190, 40], lift: "all" },
    { id: "finnegans", label: "Finnegan's Pass", at: [1093, 462], size: "small", reveal: "never", box: [1012, 441, 162, 42] },
    { id: "hundred", label: "The Hundred Kingdoms", at: [586, 525], size: "small", reveal: "your-deniables", box: [504, 492, 165, 67] },
    { id: "aelfenwode", label: "Aelfenwöde", at: [1123, 545], reveal: "never", box: [1042, 517, 162, 56] },
    { id: "rhyotish", label: "Rhyotish", at: [753, 578], size: "small", reveal: "your-deniables", box: [696, 558, 114, 40] },
    { id: "serpent", label: "Great Eastern Serpent Steppes", at: [1583, 515], size: "small", tone: "faint", reveal: "never", box: [1528, 442, 110, 146] },
    { id: "antiquity", label: "The Elven Antiquity", at: [876, 665], tone: "faint", reveal: "your-deniables", box: [698, 637, 356, 57] },
    { id: "morvannon", label: "Morvannon Archipelago", at: [177, 702], size: "small", tone: "faint", reveal: "never", box: [80, 666, 194, 72] },
    { id: "omahnd", label: "Caliphate of Omahnd", at: [656, 768], tone: "rival", reveal: "your-deniables", box: [483, 735, 347, 67] },
    { id: "halyra", label: "Sky-Caliphate of Halyra", at: [1243, 776], tone: "home", box: [1066, 748, 354, 56] },
    { id: "xalangi", label: "Xalangi Expanse", at: [1106, 866], size: "small", tone: "faint", reveal: "never", box: [962, 840, 288, 52] },
  ],
  insets: [
    {
      id: "palace", title: "The Sky Palace", cx: 1565, cy: 835, r: 100, anchor: [1232, 700], exit: [1473, 795],
      plan: [
        "M 1504 835 C 1519 788 1611 788 1626 835 C 1611 882 1519 882 1504 835 Z",
        "M 1544 820 L 1586 820 L 1586 850 L 1544 850 Z",
        "M 1519 835 L 1544 835 M 1586 835 L 1616 835",
        "M 1626 835 L 1646 835 M 1636 828 L 1636 842",
        "M 1560 808 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
      ],
    },
  ],
  waypoints: [
    { beat: "no-windows", at: [1532, 788], place: "Deep in the palace", inset: "palace", side: "above" },
    { beat: "the-dispatch", at: [1626, 850], place: "At the dock", inset: "palace", via: [[1599, 805]], side: "below" },
    { beat: "the-study", at: [1517, 855], place: "At dawn", inset: "palace", via: [[1577, 873]], side: "below" },
    { beat: "the-proclamation", at: [1574, 825], place: "The Congress hall, noon", inset: "palace", side: "left" },
    { beat: "your-deniables", at: [770, 515], place: "The AKA In, a tavern in the north", by: "sky", via: [[1010, 830], [720, 845], [600, 700], [640, 530]], side: "below" },
    { beat: "make-it-famous", at: [575, 355], place: "A tavern on the tour", by: "road", via: [[680, 445]], side: "left" },
    { beat: "the-alley", at: [604, 386], label: "The alley", place: "Behind the same tavern", by: "road", side: "below" },
    { beat: "stay-inconspicuous", at: [700, 305], place: "A watch house, the next town", by: "road", via: [[640, 330]], side: "above" },
    { beat: "morning", at: [790, 252], place: "A cottage in the snow", by: "road", via: [[748, 268]], side: "below" },
    { beat: "the-carriage", at: [862, 240], label: "The carriage", place: "A town square, late in the tour", by: "road", via: [[826, 240]], side: "right" },
  ],
  endings: [
    { outcome: "war", at: [1010, 586], label: "By noon, over the Aegis Peaks", glyph: "storm" },
    { outcome: "named", at: [926, 706], label: "By nightfall, the Frontier closed", glyph: "withdraw" },
    { outcome: "weak", at: [962, 792], label: "Three days late, in the tea houses", glyph: "fade" },
  ],
};
