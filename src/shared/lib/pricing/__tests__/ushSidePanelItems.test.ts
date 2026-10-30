import { describe, expect, it } from "vitest";

import { appendUncoveredLines, resolveSummaryLinePrice } from "../summaryLinePrice";
import type { PricingLine } from "../types";
import { ushSidePanelItems } from "../ushSidePanelItems";

const panel: PricingLine = {
  id: "sidePanel",
  group: "sidePanel",
  sku: "VAN-URSP-1GU-.4W-35.8H-19.7D-CAB-3D-1C1-HDL-LACM-43",
  quantity: 2,
  sides: ["left", "right"],
  finish: { color: "Castagno chiaro 1C1", materialSku: "3D" },
};
const options = {
  priceOfLine: (line: PricingLine) => resolveSummaryLinePrice([{ line, entry: { status: "ready", value: 412 } }]),
  swatchOf: (color: string) => ({ color: "#a07850", image: `/swatches/${color}.png` }),
  panelType: "Upper Groove",
  size: { widthCm: 1, heightCm: 91, depthCm: 46 },
  groove: { color: "Carbone 43 MT", materialSku: "LACM" },
};

describe("Summary items of the Urban Standard Height side panel line", () => {
  it("shows a piece per end the line orders, in the finish it is ordered in", () => {
    const items = ushSidePanelItems([panel], options);

    expect(items.map(({ id, title }) => [id, title])).toEqual([
      ["accessories-side-panel-left", "Side Panel Left"],
      ["accessories-side-panel-right", "Side Panel Right"],
    ]);
    expect(items[0]).toMatchObject({
      subtitle: "Upper Groove",
      sku: panel.sku,
      // A piece of the line: its unit price, not the line's.
      price: "$412.00",
      lineIds: ["sidePanel"],
      swatch: { label: "Cabinet", value: "Castagno chiaro 1C1", color: "#a07850", materialSku: "3D" },
      description: {
        "Product Category": "Side Panel",
        "Panel Type": "Upper Groove",
        Side: "left",
        Width: 1,
        Height: 91,
        // The scene's 46 cm is described as the price list's 45.5.
        Depth: 45.5,
        "Cabinet Color": "Castagno chiaro 1C1",
        "Groove Color": "Carbone 43 MT",
      },
    });
  });

  it("leaves out an end the line does not order: the panel beside a short cabinet", () => {
    const items = ushSidePanelItems([{ ...panel, quantity: 1, sides: ["right"] }], options);

    expect(items.map(({ title }) => title)).toEqual(["Side Panel Right"]);
  });

  it("shows no swatch for a line ordered without a finish", () => {
    const [item] = ushSidePanelItems([{ ...panel, finish: undefined }], options);

    expect(item.swatch).toBeUndefined();
    expect(item.description["Cabinet Color"]).toBeNull();
  });

  it("shows nothing without the line, and leaves a collection's own panel lines alone", () => {
    const own: PricingLine = { id: "sidePanel:left", group: "sidePanel", sku: "VAN-LAMEV-SP", quantity: 1 };

    expect(ushSidePanelItems([], options)).toEqual([]);
    expect(ushSidePanelItems([own], options)).toEqual([]);
  });

  it("leaves none of the line to the uncovered fallback", () => {
    const sections = [{ id: "accessories", title: "Accessories", items: ushSidePanelItems([panel], options) }];

    appendUncoveredLines(sections, [panel], () => ({ status: "ready", value: 412 }));
    expect(sections[0].items).toHaveLength(2);
  });
});
