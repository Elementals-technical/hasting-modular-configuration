import { describe, expect, it } from "vitest";

import { readDrawerOrganizers, type DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";
import type { CabinetEntry, StableCabinetKey } from "@/entities/configuration";
import pricingFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/pricing.v1.json";

import {
  ORGANIZER_BILL_EMPTY_COLUMNS,
  buildOrganizerLines,
  organizerLineId,
  parseOrganizerLineId,
  type OrganizerPricingPolicy,
} from "../organizerLines";

/**
 * Drawer organizer order lines (concept §6.4): one line per drawer, the quantity is the number of columns.
 * The function takes the read-model the scene reader fills and knows nothing of widths, zones or profiles.
 */

const METAL = "VAN-GBDIV-MTL-3.9W-2H-16.9D";
const METAL_ONLY: OrganizerPricingPolicy = { skuByStyle: { Metal: METAL }, billEmptyColumns: true };

const UNREADABLE_REASON = "The drawer organizers of this cabinet cannot be read (saved by a newer version or damaged).";

type Stand = { stableKey: StableCabinetKey; value: unknown };

/** What the fixtures call a cabinet becomes the read-model and the cabinet entries the price input holds. */
const adapt = (cabinets: readonly Stand[]) => ({
  readModel: Object.fromEntries(
    cabinets.map(({ stableKey, value }) => [stableKey, readDrawerOrganizers(value)]),
  ) as Record<StableCabinetKey, DrawerOrganizersRead>,
  entries: cabinets.map<CabinetEntry>(({ stableKey }, index) => ({ stableKey, runtimeId: `runtime-${index}`, index })),
});

const set = (columns: { slot: number; positions: number[] }[], style = "Metal") => ({ style, columns });
const column = (slot: number, positions: number[] = []) => ({ slot, positions });

describe("organizerLineId", () => {
  it("names the line after the cabinet and the drawer", () => {
    expect(organizerLineId("cab-1", "Top")).toBe("divider:cab-1:Top");
    expect(organizerLineId("cab-12", "Bot")).toBe("divider:cab-12:Bot");
  });

  it("never equals the id of a USH divider line, which ends in a slot index", () => {
    expect(organizerLineId("cab-1", "Top")).not.toMatch(/^divider:cab-1:\d+$/);
  });
});

describe("parseOrganizerLineId", () => {
  it.each([
    ["cab-1", "Top"],
    ["cab-12", "Bot"],
    // Today's keys have no colon; the drawer is what follows the last one, so one that has would still read back.
    ["cab:with:colons", "Top"],
  ] as const)("reads back what organizerLineId wrote for %s, %s", (stableKey, drawer) => {
    expect(parseOrganizerLineId(organizerLineId(stableKey, drawer))).toEqual({ stableKey, drawer });
  });

  it.each([
    ["a USH divider line, which ends in a slot index", "divider:cab-1:3"],
    ["an unknown drawer", "divider:cab-1:Middle"],
    ["another kind of line", "handle:cab-1:Top"],
    ["a line with no cabinet", "divider::Top"],
    ["a line with no drawer", "divider:cab-1"],
  ])("returns null for %s", (_what, id) => {
    expect(parseOrganizerLineId(id)).toBeNull();
  });

  it("reads the id of every line buildOrganizerLines makes", () => {
    const { readModel, entries } = adapt([
      { stableKey: "cab-1", value: { version: 1, Top: set([column(0)]), Bot: set([column(0)]) } },
      { stableKey: "cab-2", value: { version: 1, Bot: set([column(1)]) } },
    ]);

    const { lines } = buildOrganizerLines(readModel, entries, METAL_ONLY);

    expect(lines.map(({ id }) => parseOrganizerLineId(id))).toEqual([
      { stableKey: "cab-1", drawer: "Top" },
      { stableKey: "cab-1", drawer: "Bot" },
      { stableKey: "cab-2", drawer: "Bot" },
    ]);
  });
});

describe("ORGANIZER_BILL_EMPTY_COLUMNS", () => {
  it("bills an Empty column until the client says otherwise (Q-K2, unconfirmed)", () => {
    expect(ORGANIZER_BILL_EMPTY_COLUMNS).toBe(true);
  });
});

describe("cases of pricing.v1", () => {
  it.each(pricingFixture.cases.map((fixtureCase) => [fixtureCase.name, fixtureCase] as const))(
    "%s",
    (_name, fixtureCase) => {
      const { readModel, entries } = adapt(fixtureCase.input.cabinets);

      // The JSON type of the one fixture with an empty `skuByStyle` is wider than the policy.
      const policy = fixtureCase.input.policy as OrganizerPricingPolicy;

      const { lines, gaps } = buildOrganizerLines(readModel, entries, policy);

      // `sourceId` is the synthetic runtime id of the adapter: not part of the fixture.
      expect(lines.map(({ id, group, sku, quantity }) => ({ id, group, sku, quantity }))).toEqual(
        fixtureCase.expected.lines,
      );
      // Gaps compare as a set on {group, blocksTotal}.
      const asSet = (list: readonly { group: string; blocksTotal: boolean }[]) =>
        [...new Set(list.map(({ group, blocksTotal }) => `${group}/${blocksTotal}`))].sort();
      expect(asSet(gaps)).toEqual(asSet(fixtureCase.expected.gaps));
    },
  );

  it("covers the 8 cases of the card", () => {
    expect(pricingFixture.cases.map(({ name }) => name)).toEqual([
      "two-drawers",
      "sb60-two",
      "bill-empty-false",
      "bill-empty-true",
      "tricot-no-sku",
      "unsupported-version",
      "two-cabinets",
      "empty",
    ]);
  });
});

describe("buildOrganizerLines", () => {
  it("prices Class SC 60 with 2 columns in the top drawer and 3 in the bottom one as 5 columns in 2 lines", () => {
    const { readModel, entries } = adapt([
      {
        stableKey: "cab-1",
        value: {
          version: 1,
          Top: set([column(0, [2]), column(1, [4])]),
          Bot: set([column(-1), column(0, [3]), column(1, [2, 4])]),
        },
      },
    ]);

    const { lines, gaps } = buildOrganizerLines(readModel, entries, METAL_ONLY);

    expect(lines).toEqual([
      { id: "divider:cab-1:Top", group: "divider", sku: METAL, quantity: 2, sourceId: "runtime-0" },
      { id: "divider:cab-1:Bot", group: "divider", sku: METAL, quantity: 3, sourceId: "runtime-0" },
    ]);
    expect(lines.reduce((sum, { quantity }) => sum + quantity, 0)).toBe(5);
    expect(gaps).toEqual([]);
  });

  describe("order", () => {
    it("follows the cabinets by index, not the order of the entries or of the read-model", () => {
      const { readModel } = adapt([
        { stableKey: "cab-a", value: { version: 1, Top: set([column(0)]) } },
        { stableKey: "cab-b", value: { version: 1, Top: set([column(0), column(1)]) } },
        { stableKey: "cab-c", value: { version: 1, Top: set([column(0), column(1), column(2)]) } },
      ]);
      const entries: CabinetEntry[] = [
        { stableKey: "cab-c", runtimeId: "rt-c", index: 2 },
        { stableKey: "cab-a", runtimeId: "rt-a", index: 0 },
        { stableKey: "cab-b", runtimeId: "rt-b", index: 1 },
      ];

      const { lines } = buildOrganizerLines(readModel, entries, METAL_ONLY);

      expect(lines.map(({ id, sourceId }) => [id, sourceId])).toEqual([
        ["divider:cab-a:Top", "rt-a"],
        ["divider:cab-b:Top", "rt-b"],
        ["divider:cab-c:Top", "rt-c"],
      ]);
    });

    it("lists the top drawer before the bottom one, whatever the order of the keys of the value", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { Bot: set([column(0)]), version: 1, Top: set([column(0)]) } },
      ]);

      expect(buildOrganizerLines(readModel, entries, METAL_ONLY).lines.map(({ id }) => id)).toEqual([
        "divider:cab-1:Top",
        "divider:cab-1:Bot",
      ]);
    });

    it("names the runtime id of the cabinet in sourceId", () => {
      const { readModel } = adapt([{ stableKey: "cab-1", value: { version: 1, Bot: set([column(0)]) } }]);

      const { lines } = buildOrganizerLines(
        readModel,
        [{ stableKey: "cab-1", runtimeId: "sink-base-77", index: 0 }],
        METAL_ONLY,
      );

      expect(lines[0].sourceId).toBe("sink-base-77");
    });
  });

  describe("quantity", () => {
    const emptyAndFull = adapt([
      { stableKey: "cab-1", value: { version: 1, Top: set([column(-1), column(0, [2]), column(1)]) } },
    ]);

    it("counts every column, an Empty one too, while billEmptyColumns is on", () => {
      const { lines } = buildOrganizerLines(emptyAndFull.readModel, emptyAndFull.entries, METAL_ONLY);

      expect(lines.map(({ quantity }) => quantity)).toEqual([3]);
    });

    it("counts only the columns with positions when billEmptyColumns is off", () => {
      const { lines } = buildOrganizerLines(emptyAndFull.readModel, emptyAndFull.entries, {
        ...METAL_ONLY,
        billEmptyColumns: false,
      });

      expect(lines.map(({ quantity }) => quantity)).toEqual([1]);
    });

    it("writes no line for a drawer left with no column to bill", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 1, Top: set([column(0), column(1)]), Bot: set([column(0, [3])]) } },
      ]);

      const { lines, gaps } = buildOrganizerLines(readModel, entries, { ...METAL_ONLY, billEmptyColumns: false });

      expect(lines.map(({ id }) => id)).toEqual(["divider:cab-1:Bot"]);
      expect(gaps).toEqual([]);
    });

    it("counts the columns the read-model holds: widths, zones and duplicate slots are 3D's business", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 1, Top: set([column(0, [2]), column(0, [2]), column(99)]) } },
      ]);

      expect(buildOrganizerLines(readModel, entries, METAL_ONLY).lines.map(({ quantity }) => quantity)).toEqual([3]);
    });
  });

  describe("a style without a SKU (Tricot sku-profile.dividers is empty)", () => {
    const noSku: OrganizerPricingPolicy = { skuByStyle: {}, billEmptyColumns: true };

    it("writes no line and one blocking gap that names the style", () => {
      const { readModel, entries } = adapt([{ stableKey: "cab-1", value: { version: 1, Bot: set([column(2, [2])]) } }]);

      expect(buildOrganizerLines(readModel, entries, noSku)).toEqual({
        lines: [],
        gaps: [
          {
            group: "divider",
            blocksTotal: true,
            owner: "product",
            reason: "No SKU for Metal drawer organizers in this collection.",
          },
        ],
      });
    });

    it("writes one gap per style, however many drawers and cabinets use it", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 1, Top: set([column(0)]), Bot: set([column(0)]) } },
        { stableKey: "cab-2", value: { version: 1, Top: set([column(0)]) } },
      ]);

      expect(buildOrganizerLines(readModel, entries, noSku).gaps).toHaveLength(1);
    });

    it("keeps the lines of the styles that have a SKU and names the one that has none", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 1, Top: set([column(0)]), Bot: set([column(0)], "Oak") } },
      ]);

      const { lines, gaps } = buildOrganizerLines(readModel, entries, METAL_ONLY);

      expect(lines.map(({ id }) => id)).toEqual(["divider:cab-1:Top"]);
      expect(gaps.map(({ reason }) => reason)).toEqual(["No SKU for Oak drawer organizers in this collection."]);
    });

    it("treats an empty SKU as none", () => {
      const { readModel, entries } = adapt([{ stableKey: "cab-1", value: { version: 1, Top: set([column(0)]) } }]);

      const { lines, gaps } = buildOrganizerLines(readModel, entries, {
        skuByStyle: { Metal: "" },
        billEmptyColumns: true,
      });

      expect(lines).toEqual([]);
      expect(gaps).toHaveLength(1);
    });
  });

  describe("what the scene did not write, or wrote in a way this build cannot read", () => {
    it("prices nothing for a cabinet without organizers", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: null },
        { stableKey: "cab-2", value: undefined },
        { stableKey: "cab-3", value: { version: 1 } },
      ]);

      expect(buildOrganizerLines(readModel, entries, METAL_ONLY)).toEqual({ lines: [], gaps: [] });
    });

    it("prices nothing for a cabinet the read-model has no entry for", () => {
      const { entries } = adapt([{ stableKey: "cab-1", value: null }]);

      expect(buildOrganizerLines({}, entries, METAL_ONLY)).toEqual({ lines: [], gaps: [] });
    });

    it.each([
      ["a value saved by a newer version", { version: 2, Top: set([column(0)]) }],
      ["a damaged value", { version: 1, Top: { style: "Metal", columns: "none" } }],
      ["a value that is not an object", "garbage"],
    ])("blocks the total on %s and never prices it as empty", (_what, value) => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value },
        { stableKey: "cab-2", value: { version: 1, Top: set([column(0)]) } },
      ]);

      const { lines, gaps } = buildOrganizerLines(readModel, entries, METAL_ONLY);

      expect(lines.map(({ id }) => id)).toEqual(["divider:cab-2:Top"]);
      expect(gaps).toEqual([{ group: "divider", blocksTotal: true, owner: "input", reason: UNREADABLE_REASON }]);
    });

    it("writes a single gap when several cabinets cannot be read", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 3 } },
        { stableKey: "cab-2", value: { version: 2 } },
      ]);

      expect(buildOrganizerLines(readModel, entries, METAL_ONLY).gaps).toHaveLength(1);
    });
  });

  describe("read-model entries without a cabinet", () => {
    it("are ignored: a cabinet that is gone leaves no line and no gap", () => {
      const { readModel, entries } = adapt([
        { stableKey: "cab-1", value: { version: 1, Top: set([column(0)]) } },
        { stableKey: "cab-gone", value: { version: 1, Top: set([column(0)]) } },
        { stableKey: "cab-gone-too", value: { version: 2 } },
      ]);

      const { lines, gaps } = buildOrganizerLines(readModel, entries.slice(0, 1), METAL_ONLY);

      expect(lines.map(({ id }) => id)).toEqual(["divider:cab-1:Top"]);
      expect(gaps).toEqual([]);
    });
  });

  it("does not change what it is given", () => {
    const { readModel, entries } = adapt([
      { stableKey: "cab-1", value: { version: 1, Top: set([column(0, [2])]) } },
      { stableKey: "cab-2", value: { version: 2 } },
    ]);
    const before = JSON.stringify({ readModel, entries, METAL_ONLY });

    buildOrganizerLines(readModel, [...entries].reverse(), METAL_ONLY);

    expect(JSON.stringify({ readModel, entries, METAL_ONLY })).toBe(before);
  });
});
