import { describe, expect, it } from "vitest";

import type { ProductProfile } from "@/entities/collection";
import type { StableCabinetKey } from "@/entities/configuration";
import { readDrawerOrganizers, type DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";

import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import type { PricingInput } from "../types";
import {
  at,
  CLASS,
  COLLECTION_PRICING_SCENARIOS,
  collectionPricingInput,
  MAKO,
  URBAN_FREESTANDING,
  URBAN_LOW_HEIGHT,
  type CollectionCabinet,
} from "./fixtures/collectionPricingScenarios";

/**
 * Drawer organizers in the price of Class, Mako and Lame (concept §6.4): a collection whose profile has
 * `ruleData.drawerOrganizers` prices them from the read-model, one line per drawer with a column per unit,
 * and no longer from the `DividersStyle` values, which are the Urban Standard Height dividers.
 */

const METAL = "VAN-GBDIV-MTL-3.9W-2H-16.9D";

const SB: CollectionCabinet = {
  stableKey: "sb",
  runtimeId: "Sink-Base-sb",
  size: { width: 60, height: 52, depth: 52 },
};
const SC: CollectionCabinet = {
  stableKey: "sc",
  runtimeId: "Sink-Cabinet-sc",
  size: { width: 60, height: 52, depth: 52 },
};

const drawerTarget = (cabinetId: string, drawerType: "Top" | "Bot") => ({
  scope: "drawer" as const,
  cabinetId,
  drawerType,
});

/** What the scene reader keeps for each cabinet: the stored value, read as the app reads it. */
const readModelOf = (stored: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(stored).map(([stableKey, value]) => [stableKey, readDrawerOrganizers(value)]),
  ) as Record<StableCabinetKey, DrawerOrganizersRead>;

const column = (slot: number, positions: number[] = []) => ({ slot, positions });

const organizerLinesOf = (input: PricingInput) =>
  buildCollectionPricingLines(input)
    .lines.filter(({ group }) => group === "divider")
    .map(({ id, sku, quantity }) => ({ id, sku, quantity }));

const dividerGapsOf = (input: PricingInput) =>
  buildCollectionPricingLines(input)
    .gaps.filter(({ group }) => group === "divider")
    .map(({ group, blocksTotal }) => [group, blocksTotal]);

describe("organizers of Class, Mako and Lame from the read-model", () => {
  /** SC 60 with Top 2 and Bot 3 columns; an Empty column is billed (Q-K2). */
  const classOrder = (overrides: Partial<PricingInput> = {}) =>
    collectionPricingInput(
      CLASS,
      [SB, SC],
      {
        Drawers: [at({ scope: "cabinet", cabinetId: "sb" }, "2"), at({ scope: "cabinet", cabinetId: "sc" }, "2")],
        // The Urban Standard Height divider value: the organizers of this collection do not read it.
        DividersStyle: [at(drawerTarget("sb", "Top"), "Oak")],
      },
      {
        organizersByCabinet: readModelOf({
          sc: {
            version: 1,
            Top: { style: "Metal", columns: [column(-2, [2]), column(2)] },
            Bot: { style: "Metal", columns: [column(-2, [2]), column(0), column(2)] },
          },
        }),
        ...overrides,
      },
    );

  it("orders a column per unit for each drawer, named after the cabinet and the drawer", () => {
    expect(organizerLinesOf(classOrder())).toEqual([
      { id: "divider:sc:Top", sku: METAL, quantity: 2 },
      { id: "divider:sc:Bot", sku: METAL, quantity: 3 },
    ]);
  });

  it("ignores the DividersStyle values of the configuration", () => {
    const withoutValue = collectionPricingInput(
      CLASS,
      [SB, SC],
      {},
      { organizersByCabinet: classOrder().organizersByCabinet },
    );

    expect(organizerLinesOf(classOrder())).toEqual(organizerLinesOf(withoutValue));
  });

  it("keeps naming the unconfirmed divider price while the order has organizers", () => {
    expect(dividerGapsOf(classOrder())).toEqual([["divider", false]]);
  });

  it("puts the organizers where the Urban Standard Height dividers stood, after the legs", () => {
    const order = COLLECTION_PRICING_SCENARIOS["mako-vessel-with-legs"].input;
    const withOrganizers = buildCollectionPricingLines(order);
    const withoutOrganizers = buildCollectionPricingLines({ ...order, organizersByCabinet: undefined });
    const ids = withOrganizers.lines.map(({ id }) => id);

    expect(withOrganizers.lines.filter(({ group }) => group !== "divider")).toEqual(withoutOrganizers.lines);
    expect(ids[ids.indexOf("legs") + 1]).toBe("divider:mko-sb:Top");
  });
});

describe("a read-model the order cannot use", () => {
  const makoOrder = (stored: unknown) =>
    collectionPricingInput(MAKO, [SB, SC], {}, { organizersByCabinet: readModelOf({ sb: stored }) });

  it.each([
    ["saved by a newer version", { version: 2 }],
    ["damaged", { version: 1, Top: { style: "Metal", columns: [] } }],
  ])("blocks the total and adds no line for organizers %s", (_reason, stored) => {
    const order = makoOrder(stored);

    expect(organizerLinesOf(order)).toEqual([]);
    // The price of a column is not in question here: only that the organizers could not be read.
    expect(dividerGapsOf(order)).toEqual([["divider", true]]);
  });

  it("reads a cabinet without organizers as none", () => {
    const order = makoOrder({ version: 1 });

    expect(organizerLinesOf(order)).toEqual([]);
    expect(dividerGapsOf(order)).toEqual([]);
  });
});

describe("an order with no read-model", () => {
  const stale = { DividersStyle: [at(drawerTarget("sb", "Top"), "Oak")] };

  it.each([
    ["Class", CLASS],
    ["Mako", MAKO],
  ])("%s has no organizer lines and no error, whatever DividersStyle holds", (_name, collection) => {
    const order = collectionPricingInput(collection, [SB, SC], stale);
    const { lines, gaps } = buildCollectionPricingLines(order);

    expect(order.organizersByCabinet).toBeUndefined();
    expect(lines.filter(({ group }) => group === "divider")).toEqual([]);
    expect(gaps.filter(({ group }) => group === "divider")).toEqual([]);
  });
});

describe("a collection without ruleData.drawerOrganizers", () => {
  const organizers = readModelOf({
    sb: { version: 1, Top: { style: "Metal", columns: [column(-2, [2]), column(2)] } },
  });

  it.each([
    ["Urban Freestanding", URBAN_FREESTANDING],
    ["Urban Low Height", URBAN_LOW_HEIGHT],
  ])("prices %s as before when the read-model is there", (_name, collection) => {
    const values = {
      Drawers: [at({ scope: "cabinet", cabinetId: "sb" }, "2")],
      Handle: [at({ scope: "global" }, "PTO")],
      DividersStyle: [at(drawerTarget("sb", "Top"), "Metal")],
    };
    const overrides = { cabinetColor: "Castagno chiaro 1C1" };

    const before = buildCollectionPricingLines(collectionPricingInput(collection, [SB], values, overrides));
    const after = buildCollectionPricingLines(
      collectionPricingInput(collection, [SB], values, { ...overrides, organizersByCabinet: organizers }),
    );

    expect(after).toEqual(before);
  });

  it("keeps pricing a divider style as one Urban Standard Height line, whatever the read-model holds", () => {
    const withoutGate: ProductProfile = {
      ...MAKO.profile,
      ruleData: { ...MAKO.profile.ruleData, drawerOrganizers: undefined },
    };
    const order = (overrides: Partial<PricingInput>) =>
      collectionPricingInput(
        { ...MAKO, profile: withoutGate },
        [SB, SC],
        { DividersStyle: [at(drawerTarget("sb", "Top"), "Metal")] },
        overrides,
      );

    expect(organizerLinesOf(order({}))).toEqual([{ id: "divider:sb:Top", sku: METAL, quantity: 1 }]);
    expect(organizerLinesOf(order({ organizersByCabinet: organizers }))).toEqual([
      { id: "divider:sb:Top", sku: METAL, quantity: 1 },
    ]);
  });
});
