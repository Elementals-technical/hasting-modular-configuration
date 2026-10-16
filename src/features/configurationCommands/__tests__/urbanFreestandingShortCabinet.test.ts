import { describe, expect, it } from "vitest";

import profileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import bindingsDocument from "../../../../public/collections/urban-freestanding/runtime-bindings.json";
import cabinetTable590 from "@/entities/collection/__tests__/fixtures/remote/datatable-590.json";
import {
  isDrawerStyleMixingRestricted,
  parseProductProfile,
  parseRuntimeBindings,
  resolveCabinetTypeOfRuntimeId,
} from "@/entities/collection";
import type { CabinetEntry } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildSteppedSceneProducts } from "@/entities/product/lib/buildSteppedSceneProducts";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  applyConfiguratorRules,
  findPlacedCabinetRule,
  resolveMoveSwaps,
  type Selection,
} from "@/features/configurator-rule-core/cabinetBuilder";
import { findCabinetRule, firstOwnDrawers, isSteppedDrawers } from "@/shared/config/configurator/typeCabinetCatalog";

import { buildChangePlan } from "../lib/buildChangePlan";

/**
 * The Urban Freestanding Floor-Mount Short Cabinet (New 1DW Floor-Mount Short Cabinet): the
 * Short-Cabinet type of table 590, one drawer, that stands beside the taller cabinets at a height of
 * its own. The composition keeps the height of its two-drawer cabinets, and the scene bridge places
 * the short one at its own (buildSteppedSceneProducts). The scene places it as the Side Cabinet's
 * UF-side-cabinet, so its drawer style tells it apart.
 */

const profileResult = parseProductProfile(profileDocument);
const bindingsResult = parseRuntimeBindings(bindingsDocument);
if (!profileResult.ok || !bindingsResult.ok) throw new Error("Urban Freestanding data failed validation");
const profile = profileResult.profile;
const bindings = bindingsResult.bindings;
const catalog = buildCabinetCatalogFromMatrix(cabinetTable590 as unknown as ProductDatatable, profile, bindings);

const shortCabinet = findCabinetRule(catalog, "Short-Cabinet");
const sideCabinet = findCabinetRule(catalog, "Sink-Cabinet");
const sinkBase = findCabinetRule(catalog, "Sink-Base");
const cabinets: CabinetEntry[] = [
  { stableKey: "short", runtimeId: "UF-side-cabinet-short1", index: 0 },
  { stableKey: "sb", runtimeId: "UF-sink-cabinet-sb1", index: 1 },
];
const placedCabinetStyles = { "UF-side-cabinet-short1": "1", "UF-sink-cabinet-sb1": "2" };

const shortSelection: Selection = {
  cabinetType: "Short-Cabinet",
  width: 60,
  depth: 50,
  height: 91,
  drawers: "1",
  handle: "UG",
};

describe("Urban Freestanding short cabinet data", () => {
  it("is a type of its own with one drawer, at the composition's height of the tall cabinets", () => {
    expect(shortCabinet).toMatchObject({
      drawers: ["1"],
      steppedDrawers: ["1"],
      widths: [25, 35, 50, 60, 70, 80, 90, 105, 120],
      depths: [50, 46],
      handlesAllowed: ["UG", "PTO", "CG"],
      sceneProductType: "UF-side-cabinet",
      // Its own heights (53|56) are not the composition's: it takes the Sink Base's, so choosing it
      // keeps the tall cabinets at their height.
      heights: [88, 91],
      supportsHeight: [88, 91],
      forcedHeightByHandle: { UG: { "1": 91 }, PTO: { "1": 88 }, CG: { "1": 91 } },
    });
    expect(isSteppedDrawers(shortCabinet, "1")).toBe(true);
    expect(firstOwnDrawers(shortCabinet)).toBeNull();
    // The Sink Base and the Side Cabinet have two drawers only, and no short style.
    for (const rule of [sinkBase, sideCabinet]) {
      expect(rule?.drawers).toEqual(["2"]);
      expect(rule?.steppedDrawers).toBeUndefined();
      expect(rule?.forcedHeightByHandle).toEqual({ UG: { "2": 91 }, PTO: { "2": 88 }, CG: { "2": 91 } });
    }
  });

  it("is sent to the scene as the Side Cabinet's product with one drawer, at the height table 590 gives it", () => {
    const drawers = bindings.bindings.find(({ attributeId }) => attributeId === "Drawers");
    expect(drawers).toMatchObject({ values: { patches: { "1": { Drawers: "1D" }, "2": { Drawers: "2D" } } } });

    // Table 590: UG/1DW:56|PTO/1DW:53|CG/1DW:56, plinth included, as the tall 91/88.
    expect(shortCabinet?.steppedHeightByHandle).toEqual({ "1": { UG: 56, PTO: 53, CG: 56 } });
    expect(buildSteppedSceneProducts(catalog, bindings)).toEqual([
      { productType: "UF-side-cabinet", match: { Drawers: "1D" }, heightByHandle: { UG: 56, PTO: 53, CG: 56 } },
    ]);
  });

  it("reads back as the Short-Cabinet by its one-drawer style, any other UF-side-cabinet as the Side Cabinet", () => {
    expect(findPlacedCabinetRule(catalog, "UF-side-cabinet-short1", "1")?.code).toBe("Short-Cabinet");
    expect(findPlacedCabinetRule(catalog, "UF-side-cabinet-tall1", "2")?.code).toBe("Sink-Cabinet");
    expect(findPlacedCabinetRule(catalog, "UF-side-cabinet-tall1")?.code).toBe("Sink-Cabinet");
    expect(resolveCabinetTypeOfRuntimeId(profile, bindings, "UF-side-cabinet-short1", "1")).toBe("Short-Cabinet");
    expect(resolveCabinetTypeOfRuntimeId(profile, bindings, "UF-side-cabinet-tall1", "2")).toBe("Sink-Cabinet");
    expect(resolveCabinetTypeOfRuntimeId(profile, bindings, "UF-sink-cabinet-sb1", "1")).toBe("Sink-Base");
  });

  it("keeps one and two drawers apart for every other product", () => {
    // The builder lets the Short-Cabinet's style mix (CabinetBuilderPage); the groups still part the rest.
    expect(profile.ruleData.steppedModules).toEqual([
      expect.objectContaining({ cabinetType: "Short-Cabinet", drawers: "1", placement: "composition-end" }),
    ]);
    expect(isDrawerStyleMixingRestricted(profile, ["2"], "1")).toBe(true);
  });
});

describe("Urban Freestanding short cabinet rules", () => {
  it("keeps the composition's height when the short cabinet is chosen beside a placed cabinet", () => {
    const result = applyConfiguratorRules(
      shortSelection,
      { field: "cabinetType", value: "Short-Cabinet" },
      { selectedProductIds: ["UF-sink-cabinet-sb1"] },
      catalog,
      profile,
    );

    expect(result.nextSelection).toMatchObject({ cabinetType: "Short-Cabinet", drawers: "1", height: 91 });
    expect(result.availableOptions.drawers.find(({ value }) => value === "1")?.enabled).toBe(true);
    expect(result.availableOptions.handles.filter(({ enabled }) => enabled).map(({ value }) => value)).toEqual([
      "PTO",
      "UG",
      "CG",
    ]);
  });

  it("judges a handle change for the whole composition while the short cabinet is selected", () => {
    const result = buildChangePlan({
      attributeId: "Handle",
      value: "PTO",
      target: { scope: "cabinet", cabinetId: "short" },
      selection: shortSelection,
      selectedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
      catalog,
      profile,
      handleGrooveColor: null,
      cabinets,
      placedCabinetStyles,
    });

    expect(result).toMatchObject({
      ok: true,
      plan: expect.arrayContaining([
        expect.objectContaining({ attributeId: "Handle", value: "PTO" }),
        // The tall cabinets go to 88 cm; the scene bridge keeps the short one at its own.
        expect.objectContaining({ attributeId: "Height", value: 88, target: { scope: "global" } }),
      ]),
    });
  });

  it("gives the short style to the addressed cabinet alone, with no height or handle", () => {
    const result = buildChangePlan({
      attributeId: "Drawers",
      value: "1",
      target: { scope: "cabinet", cabinetId: "short" },
      selection: shortSelection,
      selectedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
      catalog,
      profile,
      handleGrooveColor: null,
      cabinets,
      placedCabinetStyles,
    });

    expect(result).toEqual({
      ok: true,
      plan: [
        { attributeId: "Drawers", value: "1", target: { scope: "cabinet", cabinetId: "short" }, origin: "requested" },
      ],
    });
  });
});

describe("Urban Freestanding short cabinet move", () => {
  /** The row after the swaps, as the scene applies them one by one. */
  const rowAfter = (row: readonly string[], swaps: readonly (readonly [string, string])[]) =>
    swaps.reduce<string[]>(
      (current, [idA, idB]) => {
        const next = [...current];
        next[current.indexOf(idA)] = idB;
        next[current.indexOf(idB)] = idA;
        return next;
      },
      [...row],
    );
  const move = (row: string[], runtimeId: string, direction: "left" | "right") => {
    const swaps = resolveMoveSwaps({
      runtimeId,
      direction,
      orderedRuntimeIds: row,
      steppedRuntimeIds: row.filter((id) => id.startsWith("S")),
    });
    return { swaps, row: rowAfter(row, swaps) };
  };
  /** Whether the tall cabinets stand together, as the scene requires after every swap. */
  const tallTogether = (row: readonly string[]) => {
    const tall = row.map((id, index) => (id.startsWith("T") ? index : -1)).filter((index) => index >= 0);
    return tall.length === 0 || tall[tall.length - 1] - tall[0] === tall.length - 1;
  };

  it("jumps the tall block to its other end, the tall cabinets keeping their order", () => {
    expect(move(["S", "T1", "T2"], "S", "right").row).toEqual(["T1", "T2", "S"]);
    expect(move(["T1", "T2", "S"], "S", "left").row).toEqual(["S", "T1", "T2"]);
    expect(move(["S1", "T1", "T2", "T3", "S2"], "S1", "right").row).toEqual(["T1", "T2", "T3", "S1", "S2"]);
  });

  it("keeps the tall cabinets together after every swap, so the scene takes each one", () => {
    const row = ["S", "T1", "T2", "T3"];
    const { swaps } = move(row, "S", "right");

    swaps.forEach((_, count) => expect(tallTogether(rowAfter(row, swaps.slice(0, count + 1)))).toBe(true));
  });

  it("swaps with the neighbour otherwise, and does nothing at the end of the row", () => {
    expect(move(["S1", "S2", "T1"], "S1", "right").swaps).toEqual([["S1", "S2"]]);
    expect(move(["T1", "T2", "S"], "T1", "right").swaps).toEqual([["T1", "T2"]]);
    expect(move(["T1", "T2", "S"], "S", "right").swaps).toEqual([]);
  });
});
