export const GRAIN_HORIZONTAL = "GrainHorizontal";
export const GRAIN_VERTICAL = "GrainVertical";

export const HPL_NO_GRAIN_FINISHES = new Set(["TKP", "TKQ", "TKN"]);
export const THREE_D_NO_GRAIN_FINISHES = new Set(["10B", "10G", "10N", "1PE"]);

export const HPL_NO_GRAIN_LABEL = "TKP, TKQ, TKN (Cepp Stone, Rox Black, Brera Brown)";
export const THREE_D_NO_GRAIN_LABEL =
  "10B, 10G, 10N, 1PE (Colortech Bianco, Colortech Grigio, Colortech Nero, Pelle Pecari Tortora)";

export const GRAIN_DIRECTION_VALUES = [
  { value: GRAIN_HORIZONTAL, label: "Horizontal" },
  { value: GRAIN_VERTICAL, label: "Vertical" },
];

export const FLUTING_VALUES = [
  { value: "None", label: "None" },
  { value: "FlutingVerticalA", label: "Vertical Asymmetrical" },
  { value: "FlutingVerticalB", label: "Vertical Symmetrical" },
  { value: "FlutingHorizontalA", label: "Horizontal Asymmetrical" },
  { value: "FlutingHorizontalB", label: "Horizontal Symmetrical" },
];

export const SIDE_PANELS_NONE = "None";
export const SYNTESI_MATERIAL_TOKEN = "Syntesi";

export const SIDE_PANEL_AVAILABILITY = [
  // 50H — SBSC: NoG only
  {
    height: "50H",
    handleType: "1D",
    cabinetType: "SBSC",
    allowed: { upperGroove: false, centerGroove: false, doubleGroove: false, noGroove: true },
  },
  {
    height: "50H",
    handleType: "2D",
    cabinetType: "SBSC",
    allowed: { upperGroove: false, centerGroove: false, doubleGroove: false, noGroove: true },
  },
  // 53H — SBSC: 1D→NoG+UpperG, 2D→NoG+CenterG
  {
    height: "53H",
    handleType: "1D",
    cabinetType: "SBSC",
    allowed: { upperGroove: true, centerGroove: false, doubleGroove: false, noGroove: true },
  },
  {
    height: "53H",
    handleType: "2D",
    cabinetType: "SBSC",
    allowed: { upperGroove: false, centerGroove: true, doubleGroove: false, noGroove: true },
  },
  // 56H — SBSC: 2D→NoG+DoubleG, 1D→NoG
  {
    height: "56H",
    handleType: "2D",
    cabinetType: "SBSC",
    allowed: { upperGroove: false, centerGroove: false, doubleGroove: true, noGroove: true },
  },
  {
    height: "56H",
    handleType: "1D",
    cabinetType: "SBSC",
    allowed: { upperGroove: false, centerGroove: false, doubleGroove: false, noGroove: true },
  },
] as const;
