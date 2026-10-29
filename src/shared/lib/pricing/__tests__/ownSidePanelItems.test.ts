import { describe, expect, it } from "vitest";

import { OWN_SIDE_PANEL_LINE_ID, ownSidePanelItems } from "../ownSidePanelItems";
import { appendUncoveredLines, resolveSummaryLinePrice } from "../summaryLinePrice";
import type { PricingLine } from "../types";

const panel: PricingLine = {
  id: OWN_SIDE_PANEL_LINE_ID,
  group: "sidePanel",
  sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933",
  quantity: 2,
  finish: { color: "Noce Canaletto 933", materialSku: "WDV" },
};
const options = {
  priceOfLine: (line: PricingLine) => resolveSummaryLinePrice([{ line, entry: { status: "ready", value: 984 } }]),
  swatchOf: (color: string) => ({ color: "#6b4f3a", image: `/swatches/${color}.png` }),
  sidePanelLeft: "active" as const,
  sidePanelRight: "active" as const,
  panelType: "No groove",
};

describe("Summary items of a collection's own side panels", () => {
  it("shows a piece per active side, in the finish the line is ordered in", () => {
    const items = ownSidePanelItems([panel], options);

    expect(items.map(({ id, title }) => [id, title])).toEqual([
      ["accessories-side-panel-left", "Side Panel Left"],
      ["accessories-side-panel-right", "Side Panel Right"],
    ]);
    expect(items[1]).toMatchObject({
      subtitle: "No groove",
      sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933",
      price: "$984.00",
      lineIds: [OWN_SIDE_PANEL_LINE_ID],
      swatch: {
        label: "Cabinet",
        value: "Noce Canaletto 933",
        color: "#6b4f3a",
        image: "/swatches/Noce Canaletto 933.png",
        materialSku: "WDV",
      },
      description: {
        "Product Category": "Side Panel",
        "Panel Type": "No groove",
        Side: "right",
        "Cabinet Color": "Noce Canaletto 933",
        elements: [{ "Product Elements": "Cabinet", Material: "WDV", "Color Code": "Noce Canaletto 933" }],
      },
    });
  });

  it("shows only the active side", () => {
    const items = ownSidePanelItems([{ ...panel, quantity: 1 }], { ...options, sidePanelLeft: "auto-removed" });

    expect(items.map(({ title }) => title)).toEqual(["Side Panel Right"]);
  });

  it("leaves the Urban Standard Height panel line to the page, and shows nothing without a line", () => {
    const ushPanel: PricingLine = { id: "sidePanel", group: "sidePanel", sku: "VAN-URSP-0G", quantity: 2 };

    expect(ownSidePanelItems([ushPanel], options)).toEqual([]);
    expect(ownSidePanelItems([], options)).toEqual([]);
  });

  it("leaves none of the panel line to the uncovered fallback", () => {
    const sections = [{ id: "accessories", title: "Accessories", items: ownSidePanelItems([panel], options) }];

    appendUncoveredLines(sections, [panel], () => ({ status: "ready", value: 984 }));
    expect(sections[0].items.map(({ id }) => id)).toEqual([
      "accessories-side-panel-left",
      "accessories-side-panel-right",
    ]);
  });
});
