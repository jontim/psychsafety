import type { WorldInput } from "../../engine/world.js";

/**
 * The Scribe's chart of Ildara, drawn basic: the southern and eastern sheets, with the story's road laid on them.
 *
 * The relationships follow the vault's rulings: Halyra far in the south below the Elven Antiquity, enclosed by
 * mountains, with the Aegis Peaks and the Brass Frontier between it and Omahnd; the Reach as a broad east-west
 * theatre around the Inner Sea; Tharcia beyond the sea's northern arm and the Tharcian Wall; Covalis north of
 * the Reach beyond the great river; Avarand far west on the Merciless Coast; Xalangi and Morvannon in the
 * south-west; the Boreal Concord off the sheet to the north. Coastlines, distances and the tour's stops are a
 * stylised picture, not a survey, and no town on the tour is named.
 *
 * Coordinates are chart units on a 1200 x 800 sheet. The four palace scenes sit in a magnified inset of the Sky
 * Palace in the south-western sea; the road leaves the inset at its rim and continues from the palace itself.
 */
export const SHADOW_FELL_CHART: NonNullable<WorldInput["chart"]> = {
  width: 1200,
  height: 800,
  title: "The Scribe's Chart",
  sheet: "Ildara · the southern and eastern sheets",
  note: "Drawn from the ballad. Not for navigation.",
  land:
    "M 330 0 C 300 28 268 44 238 56 C 198 72 158 92 140 126 C 148 162 190 182 234 202 C 252 228 236 262 216 300 " +
    "C 196 344 181 390 183 432 C 187 470 196 520 202 560 C 214 598 244 640 284 688 C 306 704 350 712 400 712 " +
    "C 448 712 486 704 522 716 C 560 736 612 782 662 796 L 900 800 C 948 776 1004 728 1074 668 C 1120 632 1160 604 1200 588 L 1200 0 Z " +
    // Morvannon: three islands in the western sea.
    "M 92 454 C 104 444 118 446 124 458 C 126 472 112 478 100 474 C 90 470 86 462 92 454 Z " +
    "M 136 480 C 150 474 166 482 164 496 C 160 508 142 510 132 502 C 126 492 128 484 136 480 Z " +
    "M 74 492 C 84 486 96 490 98 502 C 96 512 84 516 76 510 C 70 504 68 496 74 492 Z",
  waters: [
    {
      id: "inner-sea", label: "The Inner Sea", at: [1040, 440],
      d: "M 1200 322 C 1140 312 1070 316 1006 336 C 992 300 978 250 962 200 C 948 160 940 132 924 118 C 900 118 888 138 884 172 C 880 220 890 270 902 300 C 908 330 882 350 846 366 C 812 384 798 420 806 456 C 816 496 860 520 920 534 C 1000 548 1100 546 1200 532 Z",
    },
    { id: "the-lake", d: "M 856 222 C 862 212 878 212 884 222 C 886 232 876 238 866 236 C 858 234 853 229 856 222 Z" },
  ],
  rivers: [{ id: "great-northern-river", d: "M 556 172 C 640 196 740 214 883 234" }],
  ranges: [
    { id: "aegis", label: "Aegis Peaks", sub: "the Brass Frontier", at: [660, 656], tone: "frontier", points: [[548, 700], [586, 684], [624, 674], [660, 670], [696, 674], [734, 684], [772, 700]] },
    { id: "halyra-ring", points: [[548, 700], [560, 744], [600, 772], [660, 780], [720, 772], [760, 744], [772, 700]] },
    { id: "sorrow", label: "The Inner Kingdom", at: [600, 398], points: [[750, 395], [741, 415], [715, 434], [675, 447], [626, 454], [574, 454], [525, 447], [485, 434], [459, 415], [450, 395], [459, 375], [485, 356], [525, 343], [574, 336], [626, 336], [675, 343], [715, 356], [741, 375], [750, 395]] },
    { id: "wall", label: "The Tharcian Wall", at: [1094, 300], points: [[1002, 146], [1006, 196], [1012, 246], [1022, 296], [1034, 342]] },
    { id: "tharcia-high", points: [[1080, 110], [1120, 96], [1160, 104], [1195, 92]] },
    { id: "tharcia-low", points: [[1090, 210], [1130, 196], [1170, 206]] },
  ],
  forests: [
    { id: "antiquity", label: "The Elven Antiquity", at: [615, 538], d: "M 330 506 C 420 484 520 502 620 496 C 720 490 820 504 900 520 L 902 560 C 800 576 700 562 600 572 C 500 582 400 568 330 560 Z" },
    { id: "xalangi", label: "Xalangi Expanse", at: [388, 644], d: "M 300 592 C 350 578 420 582 470 600 C 500 630 490 668 440 686 C 380 696 330 690 305 664 C 288 640 288 610 300 592 Z" },
    { id: "northwood", d: "M 796 168 C 826 150 866 156 884 180 C 886 206 880 232 858 240 C 826 246 800 232 792 206 C 788 190 790 178 796 168 Z" },
  ],
  regions: [
    { id: "halyra", label: "Halyra", at: [660, 752], tone: "home", sub: "the Sky-Caliphate" },
    { id: "omahnd", label: "Omahnd", at: [700, 606], tone: "rival", sub: "the Golden Ledger" },
    { id: "reach", label: "The Reach", at: [600, 300], tone: "faint" },
    { id: "covalis", label: "Covalis", at: [640, 118], sub: "the Sovereign Crown" },
    { id: "tharcia", label: "Tharcia", at: [1108, 150], tone: "rival", sub: "the Rubrican Magisterium" },
    { id: "forbidden", label: "The Forbidden Lands", at: [330, 330], size: "small", tone: "faint" },
    { id: "merciless", label: "The Merciless Coast", at: [262, 470], size: "small", tone: "faint" },
    { id: "qoranhi", label: "Qoranhi Steppes", at: [230, 126], size: "small", tone: "faint" },
    { id: "morvannon", label: "Morvannon", at: [118, 436], size: "small", tone: "faint" },
    { id: "dragon-sea", label: "Dragon Sea", at: [80, 380], size: "small", tone: "faint" },
  ],
  places: [
    { id: "sky-palace", label: "The Sky Palace", at: [655, 720], glyph: "palace" },
    { id: "avarand", label: "Avarand", at: [190, 402], glyph: "port" },
    { id: "zhakad", label: "Port Zha'kad", at: [322, 708], glyph: "port" },
    { id: "finnegans", label: "Finnegan's Pass", at: [736, 438], glyph: "pass" },
  ],
  beyond: [
    { label: "To the Boreal Concord", at: [640, 22], dir: "n" },
    { label: "The Serpent Steppes", at: [1150, 562], dir: "e" },
  ],
  insets: [
    {
      id: "palace", title: "The Sky Palace", cx: 165, cy: 672, r: 120, anchor: [655, 720], exit: [250, 757],
      plan: [
        "M 92 672 C 110 616 220 616 238 672 C 220 728 110 728 92 672 Z",
        "M 140 654 L 190 654 L 190 690 L 140 690 Z",
        "M 110 672 L 140 672 M 190 672 L 226 672",
        "M 238 672 L 262 672 M 250 664 L 250 680",
        "M 159 640 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      ],
    },
  ],
  waypoints: [
    { beat: "no-windows", at: [126, 616], place: "Deep in the palace", inset: "palace", side: "above" },
    { beat: "the-dispatch", at: [238, 690], place: "At the dock", inset: "palace", via: [[206, 636]], side: "below" },
    { beat: "the-study", at: [108, 696], place: "At dawn", inset: "palace", via: [[180, 718]], side: "below" },
    { beat: "the-proclamation", at: [176, 660], place: "The Congress hall, noon", inset: "palace", side: "left" },
    { beat: "your-deniables", at: [838, 206], place: "The AKA In, a tavern in the north", via: [[722, 556], [792, 396]], side: "left" },
    { beat: "make-it-famous", at: [740, 330], place: "A tavern on the tour", via: [[792, 262]] },
    { beat: "the-alley", at: [770, 356], label: "The alley", place: "Behind the same tavern" },
    { beat: "stay-inconspicuous", at: [826, 270], place: "A watch house, the next town", via: [[800, 318]], side: "left" },
    { beat: "morning", at: [786, 152], place: "A cottage in the snow", via: [[770, 214]], side: "left" },
    { beat: "the-carriage", at: [872, 96], label: "The carriage", place: "A town square, late in the tour", via: [[820, 112]], side: "left" },
  ],
  endings: [
    { outcome: "war", at: [770, 640], label: "By noon, over the Aegis Peaks", glyph: "storm" },
    { outcome: "named", at: [540, 626], label: "By nightfall, the Frontier closed", glyph: "withdraw" },
    { outcome: "weak", at: [840, 598], label: "Three days late, in the tea houses", glyph: "fade" },
  ],
  compass: [86, 292],
  cartouche: [24, 20],
  scale: { at: [40, 118], px: 107, label: "250 km" },
};
