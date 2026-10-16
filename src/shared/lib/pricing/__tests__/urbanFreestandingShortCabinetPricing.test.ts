import { describe, expect, it } from "vitest";

import bindingsDocument from "../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import { parseRuntimeBindings } from "@/entities/collection";

import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { at, collectionPricingInput, URBAN_FREESTANDING } from "./fixtures/collectionPricingScenarios";

const parsedBindings = parseRuntimeBindings(bindingsDocument);
if (!parsedBindings.ok) throw new Error("Urban Freestanding bindings failed validation");

/**
 * The Urban Freestanding Floor-Mount Short Cabinet (Short-Cabinet) is priced as the Side Cabinet (team,
 * 2026-10-15): the same SKU with 1DW and its own height, 56 cm (22") with the plinth for UG and CG.
 * The side panel beside it has no confirmed height yet (P1125, UFS-SP-01).
 */
describe("Urban Freestanding Floor-Mount Short Cabinet pricing", () => {
  const sinkBase = { stableKey: "sb", runtimeId: "UF-sink-cabinet-sb", size: { width: 60, height: 91, depth: 50 } };
  const short = { stableKey: "short", runtimeId: "UF-side-cabinet-short", size: { width: 90, height: 56, depth: 50 } };
  const order = (
    cabinets: (typeof sinkBase)[],
    placedCabinetStyles: Record<string, string>,
    sidePanelsOption = "None",
  ) =>
    buildCollectionPricingLines(
      collectionPricingInput(
        URBAN_FREESTANDING,
        cabinets,
        {
          Drawers: [at({ scope: "cabinet", cabinetId: "sb" }, "2")],
          Handle: [at({ scope: "global" }, "UG")],
          SidePanels: [at({ scope: "global" }, sidePanelsOption)],
        },
        {
          cabinetColor: "Castagno chiaro 1C1",
          placedCabinetStyles,
          runtimeBindings: parsedBindings.bindings,
          sidePanelsOption,
          sidePanelLeft: sidePanelsOption === "None" ? "none" : "active",
          sidePanelRight: sidePanelsOption === "None" ? "none" : "active",
        },
      ),
    );

  it("prices the short cabinet as the two-drawer one, with 1DW and its own height", () => {
    const { lines, gaps } = order([short, sinkBase], { "UF-side-cabinet-short": "1", "UF-sink-cabinet-sb": "2" });

    expect(lines.filter(({ group }) => group === "cabinet").map(({ sku, sourceId }) => [sourceId, sku])).toEqual([
      ["UF-side-cabinet-short", "VAN-URFS-SC/1DW/UG/X-35.4W-22H-19.7D-CAB-3D-1C1-HDL-3D-1C1"],
      ["UF-sink-cabinet-sb", "VAN-URFS-SB/2DW/UG/X-23.6W-35.8H-19.7D-CAB-3D-1C1-HDL-3D-1C1"],
    ]);
    expect(gaps.some(({ group }) => group === "input")).toBe(false);
  });

  it("prices the panel at the tall end at the tall height and leaves the one beside the short cabinet out", () => {
    const { lines, gaps } = order(
      [short, sinkBase],
      { "UF-side-cabinet-short": "1", "UF-sink-cabinet-sb": "2" },
      "NoG",
    );

    // 91 cm (35.8") at the Sink Base end, never the short cabinet's 56 cm.
    expect(lines.filter(({ group }) => group === "sidePanel")).toEqual([
      expect.objectContaining({ sku: expect.stringContaining("-35.8H-"), quantity: 1 }),
    ]);
    expect(gaps).toContainEqual(
      expect.objectContaining({
        group: "sidePanel",
        blocksTotal: true,
        reason: expect.stringContaining("beside the Floor-Mount Short Cabinet"),
      }),
    );
  });
});
