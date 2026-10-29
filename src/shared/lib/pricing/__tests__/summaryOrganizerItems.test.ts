import { describe, expect, it } from "vitest";

import { readDrawerOrganizers, type DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";
import type { CabinetEntry, StableCabinetKey } from "@/entities/configuration";

import { buildOrganizerLines } from "../organizerLines";
import { buildOrganizerSummaryItems } from "../summaryOrganizerItems";
import type { PricingLine } from "../types";

/**
 * Summary items of the Ph2 drawer organizers: one per priced drawer line. The page adds the price
 * (`priceOfLines([line], line.quantity)`), so the item carries the line and not a price.
 */

const METAL = "VAN-GBDIV-MTL-3.9W-2H-16.9D";
const POLICY = { skuByStyle: { Metal: METAL }, billEmptyColumns: true };

const labels: Record<string, string> = { "DividersStyle:Metal": "Metal" };
const labelOf = (attributeId: string, value: string) => labels[`${attributeId}:${value}`] ?? null;

const set = (slots: number[], style = "Metal") => ({
  style,
  columns: slots.map((slot) => ({ slot, positions: [] as number[] })),
});

/** Reads raw scene values like the scene reader does, and prices them. */
const stand = (cabinets: { stableKey: StableCabinetKey; value: unknown; index?: number }[]) => {
  const readModel = Object.fromEntries(
    cabinets.map(({ stableKey, value }) => [stableKey, readDrawerOrganizers(value)]),
  ) as Record<StableCabinetKey, DrawerOrganizersRead>;
  const entries = cabinets.map<CabinetEntry>(({ stableKey, index }, at) => ({
    stableKey,
    runtimeId: `runtime-${at}`,
    index: index ?? at,
  }));
  const { lines } = buildOrganizerLines(readModel, entries, POLICY);
  return { readModel, entries, lines };
};

describe("buildOrganizerSummaryItems", () => {
  it("shows an item per drawer line: the top and the bottom drawer of Class SC 60", () => {
    const { readModel, entries, lines } = stand([
      { stableKey: "cab-1", value: { version: 1, Top: set([0, 1]), Bot: set([-1, 0, 1]) } },
    ]);

    const items = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(items).toEqual([
      {
        id: "accessories-organizer-cab-1-Top",
        title: "Drawer Organizer",
        subtitle: "Metal × 2 · Top drawer",
        sku: METAL,
        copyable: true,
        showInfo: true,
        description: {
          "Product Category": "Drawer Organizer",
          Material: "Metal",
          Columns: "2",
          Drawer: "Top",
          Width: "3.9″",
          Height: "2″",
          Depth: "16.9″",
        },
        lineIds: ["divider:cab-1:Top"],
        line: lines[0],
      },
      {
        id: "accessories-organizer-cab-1-Bot",
        title: "Drawer Organizer",
        subtitle: "Metal × 3 · Bottom drawer",
        sku: METAL,
        copyable: true,
        showInfo: true,
        description: {
          "Product Category": "Drawer Organizer",
          Material: "Metal",
          Columns: "3",
          Drawer: "Bottom",
          Width: "3.9″",
          Height: "2″",
          Depth: "16.9″",
        },
        lineIds: ["divider:cab-1:Bot"],
        line: lines[1],
      },
    ]);
  });

  it("hands the line itself to the page, which prices it as `line.quantity` units", () => {
    const { readModel, entries, lines } = stand([{ stableKey: "cab-1", value: { version: 1, Bot: set([0, 1, 2]) } }]);

    const [item] = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(item.line).toBe(lines[0]);
    expect(item.line.quantity).toBe(3);
    expect(item.lineIds).toEqual([lines[0].id]);
  });

  it("names the style by the label of the profile and falls back to the style itself", () => {
    const { readModel, entries, lines } = stand([{ stableKey: "cab-1", value: { version: 1, Top: set([0]) } }]);

    const [labelled] = buildOrganizerSummaryItems({
      lines,
      readModel,
      cabinets: entries,
      labelOf: (attributeId, value) => (attributeId === "DividersStyle" && value === "Metal" ? "Metal Tray" : null),
    });
    const [unlabelled] = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf: () => null });

    expect(labelled.subtitle).toBe("Metal Tray × 1 · Top drawer");
    expect(labelled.description.Material).toBe("Metal Tray");
    expect(unlabelled.subtitle).toBe("Metal × 1 · Top drawer");
    expect(unlabelled.description.Material).toBe("Metal");
  });

  it("adds the cabinet number to the subtitle when organizers stand in more than one cabinet", () => {
    const { readModel, entries, lines } = stand([
      { stableKey: "cab-7", index: 2, value: { version: 1, Top: set([0]) } },
      { stableKey: "cab-9", index: 0, value: { version: 1, Top: set([0, 1]), Bot: set([0]) } },
    ]);

    const items = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(items.map(({ id, subtitle }) => [id, subtitle])).toEqual([
      ["accessories-organizer-cab-9-Top", "Metal × 2 · Top drawer · Cabinet 1"],
      ["accessories-organizer-cab-9-Bot", "Metal × 1 · Bottom drawer · Cabinet 1"],
      ["accessories-organizer-cab-7-Top", "Metal × 1 · Top drawer · Cabinet 3"],
    ]);
  });

  it("leaves the number out while one cabinet holds all the organizers, however many cabinets there are", () => {
    const { readModel, entries, lines } = stand([
      { stableKey: "cab-1", value: null },
      { stableKey: "cab-2", value: { version: 1, Bot: set([0]) } },
    ]);

    const [item] = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(item.subtitle).toBe("Metal × 1 · Bottom drawer");
  });

  it("follows the order of the lines", () => {
    const { readModel, entries, lines } = stand([
      { stableKey: "cab-1", value: { version: 1, Top: set([0]), Bot: set([0]) } },
    ]);

    const items = buildOrganizerSummaryItems({ lines: [...lines].reverse(), readModel, cabinets: entries, labelOf });

    expect(items.map(({ lineIds }) => lineIds[0])).toEqual(["divider:cab-1:Bot", "divider:cab-1:Top"]);
  });

  it("states the columns the order holds: with Empty columns not billed, the quantity", () => {
    const readModel = {
      "cab-1": readDrawerOrganizers({
        version: 1,
        Top: {
          style: "Metal",
          columns: [
            { slot: 0, positions: [] },
            { slot: 1, positions: [2] },
            { slot: 2, positions: [] },
          ],
        },
      }),
    };
    const entries: CabinetEntry[] = [{ stableKey: "cab-1", runtimeId: "runtime-0", index: 0 }];
    const { lines } = buildOrganizerLines(readModel, entries, { ...POLICY, billEmptyColumns: false });

    const [item] = buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(item.subtitle).toBe("Metal × 1 · Top drawer");
    expect(item.description.Columns).toBe("1");
  });

  describe("lines it does not show", () => {
    it("skips the divider lines of USH, which end in a slot index", () => {
      const { readModel, entries, lines } = stand([{ stableKey: "cab-1", value: { version: 1, Top: set([0]) } }]);
      const ush: PricingLine = { id: "divider:cab-1:0", group: "divider", sku: "DIV-A", quantity: 1 };

      const items = buildOrganizerSummaryItems({ lines: [ush, ...lines], readModel, cabinets: entries, labelOf });

      expect(items.map(({ lineIds }) => lineIds)).toEqual([["divider:cab-1:Top"]]);
    });

    it("skips lines of other groups, even with the id of an organizer", () => {
      const { readModel, entries } = stand([{ stableKey: "cab-1", value: { version: 1, Top: set([0]) } }]);
      const other: PricingLine = { id: "divider:cab-1:Top", group: "towelBar", sku: "TB", quantity: 1 };

      expect(buildOrganizerSummaryItems({ lines: [other], readModel, cabinets: entries, labelOf })).toEqual([]);
    });

    it("skips a line whose drawer has no set in the read-model", () => {
      const { readModel, entries } = stand([
        { stableKey: "cab-1", value: { version: 1, Top: set([0]) } },
        { stableKey: "cab-2", value: { version: 2 } },
        { stableKey: "cab-3", value: null },
      ]);
      const lines: PricingLine[] = ["cab-1:Bot", "cab-2:Top", "cab-3:Top", "cab-4:Top"].map((id) => ({
        id: `divider:${id}`,
        group: "divider",
        sku: METAL,
        quantity: 1,
      }));

      expect(buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf })).toEqual([]);
    });

    it("shows nothing without lines", () => {
      const { readModel, entries } = stand([{ stableKey: "cab-1", value: { version: 1, Top: set([0]) } }]);

      expect(buildOrganizerSummaryItems({ lines: [], readModel, cabinets: entries, labelOf })).toEqual([]);
    });
  });

  it("does not change what it is given", () => {
    const { readModel, entries, lines } = stand([{ stableKey: "cab-1", value: { version: 1, Top: set([0]) } }]);
    const before = JSON.stringify({ readModel, entries, lines });

    buildOrganizerSummaryItems({ lines, readModel, cabinets: entries, labelOf });

    expect(JSON.stringify({ readModel, entries, lines })).toBe(before);
  });
});
