import { describe, expect, it } from "vitest";

import profileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import bindingsDocument from "../../../../public/collections/urban-freestanding/runtime-bindings.json";
import cabinetTable590 from "@/entities/collection/__tests__/fixtures/remote/datatable-590.json";
import { isDrawerStyleMixingRestricted, parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import type { CabinetEntry } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildSteppedSceneProducts } from "@/entities/product/lib/buildSteppedSceneProducts";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  applyConfiguratorRules,
  resolveSteppedEndPlacement,
  type Selection,
} from "@/features/configurator-rule-core/cabinetBuilder";
import { findCabinetRule, firstOwnDrawers, isSteppedDrawers } from "@/shared/config/configurator/typeCabinetCatalog";

import { buildChangePlan } from "../lib/buildChangePlan";

/**
 * The Urban Freestanding 1 Drawer Short (New 1DW Floor-Mount Short Cabinet): a Side Cabinet style
 * that stands beside the taller cabinets at a height of its own. Table 590 lists it as
 * 1DW with its heights; the composition keeps the height of its two-drawer cabinets, and the scene
 * bridge places the short one at its own (buildSteppedSceneProducts).
 */

const profileResult = parseProductProfile(profileDocument);
const bindingsResult = parseRuntimeBindings(bindingsDocument);
if (!profileResult.ok || !bindingsResult.ok) throw new Error("Urban Freestanding data failed validation");
const profile = profileResult.profile;
const bindings = bindingsResult.bindings;
const catalog = buildCabinetCatalogFromMatrix(cabinetTable590 as unknown as ProductDatatable, profile, bindings);

const sideCabinet = findCabinetRule(catalog, "Sink-Cabinet");
const sinkBase = findCabinetRule(catalog, "Sink-Base");
const cabinets: CabinetEntry[] = [
  { stableKey: "short", runtimeId: "UF-side-cabinet-short1", index: 0 },
  { stableKey: "sb", runtimeId: "UF-sink-cabinet-sb1", index: 1 },
];

const tallSelection: Selection = {
  cabinetType: "Sink-Cabinet",
  width: 60,
  depth: 50,
  height: 91,
  drawers: "2",
  handle: "UG",
};

describe("Urban Freestanding short cabinet data", () => {
  it("is a stepped style of the Side Cabinet only, with the type's widths, depths and handles", () => {
    expect(sideCabinet).toMatchObject({
      drawers: ["2", "1"],
      steppedDrawers: ["1"],
      widths: [25, 35, 50, 60, 70, 80, 90, 105, 120],
      depths: [50, 46],
      handlesAllowed: ["UG", "PTO", "CG"],
      // The table's 1DW heights are the short cabinet's own, not the composition's: they stay out.
      heights: [88, 91],
      forcedHeightByHandle: { UG: { "2": 91 }, PTO: { "2": 88 }, CG: { "2": 91 } },
    });
    // A Sink Base with its basin has no short style.
    expect(sinkBase?.drawers).toEqual(["2"]);
    expect(sinkBase?.steppedDrawers).toBeUndefined();
    expect(isSteppedDrawers(sideCabinet, "1")).toBe(true);
    expect(isSteppedDrawers(sideCabinet, "2")).toBe(false);
    expect(firstOwnDrawers(sideCabinet)).toBe("2");
  });

  it("is sent to the scene with one drawer, at the height table 590 gives it", () => {
    const drawers = bindings.bindings.find(({ attributeId }) => attributeId === "Drawers");
    expect(drawers).toMatchObject({ values: { patches: { "1": { Drawers: "1D" }, "2": { Drawers: "2D" } } } });

    // Table 590: UG/1DW:56|PTO/1DW:53|CG/1DW:56, plinth included, as the tall 91/88.
    expect(sideCabinet?.steppedHeightByHandle).toEqual({ "1": { UG: 56, PTO: 53, CG: 56 } });
    expect(buildSteppedSceneProducts(catalog, bindings)).toEqual([
      { productType: "UF-side-cabinet", match: { Drawers: "1D" }, heightByHandle: { UG: 56, PTO: 53, CG: 56 } },
    ]);
  });

  it("mixes with the two-drawer style without switching the composition's drawers", () => {
    expect(isDrawerStyleMixingRestricted(profile, ["2"], "1")).toBe(false);
    expect(isDrawerStyleMixingRestricted(profile, ["1", "2"], "2")).toBe(false);
  });
});

describe("Urban Freestanding short cabinet rules", () => {
  it("keeps the composition's height when the short style is chosen beside a placed cabinet", () => {
    const result = applyConfiguratorRules(
      { ...tallSelection, drawers: "1" },
      { field: "drawers", value: "1" },
      { selectedProductIds: ["UF-sink-cabinet-sb1"] },
      catalog,
      profile,
    );

    expect(result.nextSelection).toMatchObject({ drawers: "1", height: 91 });
    expect(result.availableOptions.drawers.find(({ value }) => value === "1")?.enabled).toBe(true);
    expect(result.availableOptions.handles.filter(({ enabled }) => enabled).map(({ value }) => value)).toEqual([
      "PTO",
      "UG",
      "CG",
    ]);
  });

  it("judges a handle change for the composition's own drawers while the short cabinet is selected", () => {
    const result = buildChangePlan({
      attributeId: "Handle",
      value: "PTO",
      target: { scope: "cabinet", cabinetId: "short" },
      selection: { ...tallSelection, drawers: "1" },
      selectedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
      catalog,
      profile,
      handleGrooveColor: null,
      cabinets,
    });

    expect(result).toMatchObject({
      ok: true,
      plan: expect.arrayContaining([
        expect.objectContaining({ attributeId: "Handle", value: "PTO" }),
        // The tall cabinets go to 88 cm; the scene keeps the short one at its own (buildSteppedSceneProducts).
        expect.objectContaining({ attributeId: "Height", value: 88, target: { scope: "global" } }),
      ]),
    });
  });

  it("gives the short style to the addressed cabinet alone, with no height or handle", () => {
    const result = buildChangePlan({
      attributeId: "Drawers",
      value: "1",
      target: { scope: "cabinet", cabinetId: "short" },
      selection: tallSelection,
      selectedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
      catalog,
      profile,
      handleGrooveColor: null,
      cabinets,
    });

    expect(result).toEqual({
      ok: true,
      plan: [
        { attributeId: "Drawers", value: "1", target: { scope: "cabinet", cabinetId: "short" }, origin: "requested" },
      ],
    });
  });
});

describe("Urban Freestanding short cabinet placement", () => {
  const ordered = ["UF-side-cabinet-short1", "UF-sink-cabinet-sb1", "UF-side-cabinet-tall2"];
  const place = (anchorRuntimeId: string, side: "left" | "right", addsEndCabinet = false) =>
    resolveSteppedEndPlacement({
      anchorRuntimeId,
      side,
      orderedRuntimeIds: ordered,
      steppedRuntimeIds: ["UF-side-cabinet-short1"],
      addsEndCabinet,
    });

  it("puts a taller cabinet asked for outside the short one inside it, so the short one stays at the end", () => {
    expect(place("UF-side-cabinet-short1", "left")).toEqual({
      anchorRuntimeId: "UF-side-cabinet-short1",
      side: "right",
    });
    expect(place("UF-side-cabinet-short1", "right")).toEqual({
      anchorRuntimeId: "UF-side-cabinet-short1",
      side: "right",
    });
    expect(place("UF-side-cabinet-tall2", "right")).toEqual({
      anchorRuntimeId: "UF-side-cabinet-tall2",
      side: "right",
    });
  });

  it("places a cabinet that stands at an end itself where it was asked to", () => {
    expect(place("UF-side-cabinet-short1", "left", true)).toEqual({
      anchorRuntimeId: "UF-side-cabinet-short1",
      side: "left",
    });
  });
});
