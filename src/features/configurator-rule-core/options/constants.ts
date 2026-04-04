export const GRAIN_HORIZONTAL = "GrainHorizontal";
export const GRAIN_VERTICAL = "GrainVertical";

export const HPL_NO_GRAIN_FINISHES = new Set(["TKP", "TKQ", "TKN"]);
export const THREE_D_NO_GRAIN_FINISHES = new Set(["10B", "10F", "1A1", "1A2", "1A3", "1A4", "1A5", "1PE"]);

export const HPL_NO_GRAIN_LABEL = "TKP, TKQ, TKN (Cepp Stone, Rox Black, Brera Brown)";
export const THREE_D_NO_GRAIN_LABEL =
  "10B, 10F, 1A1, 1A2, 1A3, 1A4, 1A5, 1PE (Colortech Bianco, Colortech Grigio fume, Cemento Cenere, Cemento Tortora, Cemento Creta, Cemento Oltremare, Cemento Ghiaccio, Pelle Pecari Tortora)";

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

export { SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN, SIDE_PANEL_AVAILABILITY } from "@/features/sidePanel/lib/constants";
