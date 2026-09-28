import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable579 from "@/entities/collection/__tests__/fixtures/remote/datatable-579.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import cabinetTable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  parseProductProfile,
  resolveCabinetTypeOfRuntimeId,
  type ProductProfile,
  type RuntimeBindingSet,
} from "@/entities/collection";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";

import { findPlacedCabinetRule } from "../lib/placedCabinetRule";

/**
 * The builder rules read a placed cabinet's type from its runtime id as the rest of the
 * configurator does, for every collection: the id names the scene product that placed it.
 */

const parse = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error("profile must parse");
  return parsed.profile;
};

const COLLECTIONS: {
  name: string;
  profile: ProductProfile;
  bindings: RuntimeBindingSet;
  table: unknown;
  /** Runtime ids as each scene names its placed products, with the cabinet type they place. */
  placed: Record<string, string>;
}[] = [
  {
    name: "Urban Standard Height",
    profile: ushProfile,
    bindings: ushRuntimeBindings,
    table: cabinetTable439,
    placed: { "Sink-Base-1": "Sink-Base", "Sink-Cabinet-2": "Sink-Cabinet", "Open-Shelf-3": "Open-Shelf" },
  },
  {
    name: "Urban Low Height",
    profile: parse(ulhProfileDocument),
    bindings: ulhRuntimeBindings,
    table: cabinetTable580,
    placed: {
      "ULH-sink-cabinet-l4dkl0l8x": "Sink-Base",
      "ULH-side-cabinet-14f7v5hpm": "Side-Cabinet",
      "ULH-Open-Shelf-mj7srk5g9": "Open-Shelf",
    },
  },
  {
    name: "Mako",
    profile: makoProfile,
    bindings: makoRuntimeBindings,
    table: cabinetTable581,
    // "Mako-sink-cabinet" holds "sink-cabinet", the code of the side cabinet: the scene product decides.
    placed: { "Mako-sink-cabinet-k3j4h5g6f": "Sink-Base", "Mako-side-cabinet-a1b2c3": "Sink-Cabinet" },
  },
  {
    name: "Class",
    profile: parse(classProfileDocument),
    bindings: classRuntimeBindings,
    table: cabinetTable579,
    placed: { "Class-sink-cabinet-k3j4h5g6f": "Sink-Base", "Class-side-cabinet-a1b2c3": "Sink-Cabinet" },
  },
];

describe("findPlacedCabinetRule", () => {
  it.each(COLLECTIONS)("reads each placed $name cabinet as the configurator does", (collection) => {
    const catalog = buildCabinetCatalogFromMatrix(
      collection.table as ProductDatatable,
      collection.profile,
      collection.bindings,
    );

    for (const [runtimeId, cabinetType] of Object.entries(collection.placed)) {
      expect(findPlacedCabinetRule(catalog, runtimeId)?.code).toBe(cabinetType);
      expect(resolveCabinetTypeOfRuntimeId(collection.profile, collection.bindings, runtimeId)).toBe(cabinetType);
    }
  });

  it("reads the cabinet type the id starts with from a catalog built without the bindings", () => {
    const catalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, ushProfile);

    expect(findPlacedCabinetRule(catalog, "Sink-Cabinet-2")?.code).toBe("Sink-Cabinet");
    expect(findPlacedCabinetRule(catalog, "rt-1")).toBeNull();
  });
});
