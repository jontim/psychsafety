import type { WorldInput } from "../../engine/world.js";

/**
 * The Scribe's chart, on Jon's map.
 *
 * The artwork is Jon's inked plate of the continent (1672 x 940): a clean plate under the road, and a lettered
 * plate whose region names are unmasked as the road reaches them, the way his own map animation reveals them.
 * Until his plates arrive the two are frames of that animation (the first frame, with the Humā at her moorings
 * over Halyra, and the last, with every name in place), and the vehicles are cut from it. Swap the files under
 * public/chart to replace them; the coordinates below are plate pixels.
 *
 * The route follows the one Jon drew: west from Halyra along the southern coast through Omahnd, north through
 * the Elven Antiquity to the Hundred Kingdoms and the Inner Kingdom, where the skyship lands; then by carriage
 * north-west through the Forbidden Lands and north-east to Covalis. The story's stops sit on it: the hire where
 * the ship lands, the tour along the carriage road. No town on the tour is named; the four palace scenes sit in
 * a magnified inset of the Sky Palace in the south-eastern sea.
 */
export const SHADOW_FELL_CHART: NonNullable<WorldInput["chart"]> = {
  width: 1672,
  height: 940,
  title: "The Scribe's Chart",
  sheet: "Ildara, as the ballad tells it",
  plate: { clean: "/chart/plate.jpg", lettered: "/chart/plate-lettered.jpg" },
  vehicles: {
    sky: { src: "/chart/ship.png", width: 150, height: 120, faces: "left" },
    road: { src: "/chart/carriage.png", alt: "/chart/carriage-left.png", width: 212, height: 86, faces: "right" },
  },
  // Region names live on the lettered plate; each box is unmasked when the road arrives at its beat.
  regions: [
    { id: "omahnd", label: "Caliphate of Omahnd", at: [653, 768], tone: "rival", reveal: "your-deniables", box: [500, 748, 306, 40] },
    { id: "antiquity", label: "The Elven Antiquity", at: [870, 661], tone: "faint", reveal: "your-deniables", box: [700, 643, 340, 36] },
    { id: "hundred", label: "The Hundred Kingdoms", at: [588, 526], size: "small", reveal: "your-deniables", box: [508, 498, 160, 56] },
    { id: "inner", label: "The Inner Kingdom", at: [854, 475], reveal: "your-deniables", box: [750, 460, 210, 30] },
    { id: "rhyotish", label: "Rhyotish", at: [746, 578], size: "small", reveal: "your-deniables", box: [698, 566, 96, 24] },
    { id: "avarand", label: "Avarand", at: [331, 371], reveal: "make-it-famous", box: [262, 356, 138, 30] },
    { id: "forbidden", label: "The Forbidden Lands", at: [580, 340], reveal: "make-it-famous", box: [478, 308, 210, 66] },
    { id: "reach", label: "The Reach", at: [861, 366], reveal: "make-it-famous", box: [756, 349, 210, 34] },
    { id: "morrighad", label: "Morrighad", at: [454, 271], size: "small", reveal: "make-it-famous", box: [400, 260, 108, 22] },
    { id: "covalis", label: "Covalis", at: [887, 191], reveal: "the-carriage", box: [808, 174, 158, 30] },
    { id: "halyra", label: "Sky-Caliphate of Halyra", at: [1235, 778], tone: "home", box: [1062, 760, 346, 38] },
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
