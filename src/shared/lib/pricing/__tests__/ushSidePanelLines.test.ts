import { describe, expect, it } from "vitest";

import { SKU_SERIES_BY_COLLECTION } from "@/shared/lib/sku";

import { buildUshSidePanelLines, type UshSidePanelLinesInput } from "../ushSidePanelLines";

const input = (
  sidePanelLeft: UshSidePanelLinesInput["sidePanelLeft"],
  sidePanelRight: UshSidePanelLinesInput["sidePanelRight"],
): UshSidePanelLinesInput => ({
  series: SKU_SERIES_BY_COLLECTION["urban-standard-height"],
  panelType: "NoG",
  sidePanelLeft,
  sidePanelRight,
  heightCm: 91,
  depthCm: 50,
  cabinet: { materialSku: "3D", colorCode: "1C1", color: "Castagno chiaro 1C1" },
  groove: { materialSku: null, colorCode: null },
});

describe("The Urban Standard Height side panel line", () => {
  it("orders a piece per active end and names those ends", () => {
    expect(buildUshSidePanelLines(input("active", "active"))).toEqual([
      expect.objectContaining({ id: "sidePanel", quantity: 2, sides: ["left", "right"] }),
    ]);
    expect(buildUshSidePanelLines(input("auto-removed", "active"))).toEqual([
      expect.objectContaining({ quantity: 1, sides: ["right"] }),
    ]);
    expect(buildUshSidePanelLines(input("active", "none"))).toEqual([
      expect.objectContaining({ quantity: 1, sides: ["left"] }),
    ]);
  });

  it("is ordered in the cabinet's finish, as the palette names its colour", () => {
    expect(buildUshSidePanelLines(input("active", "active"))[0]).toMatchObject({
      sku: "VAN-URSP-0G-.4W-35.8H-19.7D-CAB-3D-1C1",
      finish: { color: "Castagno chiaro 1C1", materialSku: "3D" },
    });
  });

  it("names no finish while the cabinet's material is unknown", () => {
    const [line] = buildUshSidePanelLines({
      ...input("active", "active"),
      cabinet: { materialSku: null, colorCode: null, color: "Castagno chiaro 1C1" },
    });

    expect(line).not.toHaveProperty("finish");
  });

  it("orders nothing while no end is active", () => {
    expect(buildUshSidePanelLines(input("none", "auto-removed"))).toEqual([]);
  });
});
