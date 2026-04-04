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
