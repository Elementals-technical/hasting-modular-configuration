/** Cabinet Type → SKU code (Product Parameters Matrix → Cabinet) */
export const cabinetTypeSkuMap: Record<string, string> = {
  "Sink-Base": "SB",
  "Side-Cabinet": "SC",
  "Open-Shelf": "OS",
  "Side-Shelf": "OSS",
};

/** Drawer config → SKU code (PlayCanvas format: "1D", "2D", "1DWID") */
export const drawerSkuMap: Record<string, string> = {
  "1D": "1DW",
  "2D": "2DW",
  "1DWID": "1DWID",
};

/** Handle type → SKU code */
export const handleSkuMap: Record<string, string> = {
  handle_urban_topcut: "UG",
  handle_urban_botcut: "CG",
  handle_pto: "PTO",
};

/** Front pattern / fluting → SKU code */
export const patternSkuMap: Record<string, string> = {
  FlutingVerticalA: "FVA",
  FlutingVerticalB: "FVB",
  FlutingHorizontalA: "FHA",
  FlutingHorizontalB: "FHB",
  Uniform: "URF",
  Staggered: "SRF",
  Cannette: "CRF",
  Rigatino: "RRF",
  None: "X",
};

/** Side panel style → SKU code */
export const sidePanelSkuMap: Record<string, string> = {
  None: "X",
  NoG: "NOG",
  UpperG: "UPG",
  CenterG: "CTG",
  DoubleG: "DBG",
};

/** Divider style → SKU code */
export const dividerSkuMap: Record<string, string> = {
  "Option A": "DVA",
  "Option B": "DVB",
  "Option C": "DVC",
  None: "X",
};

/** Towel bar position → SKU code */
export const towelBarSkuMap: Record<string, string> = {
  None: "X",
  Left: "TBL",
  Right: "TBR",
  Both: "TBB",
};
