import { afterEach, describe, expect, it, vi } from "vitest";

import profileDocument from "../../../../../public/collections/urban-freestanding/product-profile.json";
import bindingsDocument from "../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import cabinetTable590 from "@/entities/collection/__tests__/fixtures/remote/datatable-590.json";
import { parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import type { ProductDatatable } from "@/entities/product/api";
import { buildSteppedSceneProducts } from "@/entities/product/lib/buildSteppedSceneProducts";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";

import {
  isSteppedSceneConfig,
  resolveSteppedHeightCorrections,
  restoreSteppedSceneHeights,
  setSteppedSceneProducts,
  steppedSceneHeightOf,
  touchesSteppedHeight,
  withSteppedSceneHeight,
} from "../steppedSceneProducts";

vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

// The short cabinets as CollectionStateBridge hands them over: from table 590 through the catalog.
const profileResult = parseProductProfile(profileDocument);
const bindingsResult = parseRuntimeBindings(bindingsDocument);
if (!profileResult.ok || !bindingsResult.ok) throw new Error("Urban Freestanding data failed validation");
const catalog = buildCabinetCatalogFromMatrix(
  cabinetTable590 as unknown as ProductDatatable,
  profileResult.profile,
  bindingsResult.bindings,
);
const stepped = buildSteppedSceneProducts(catalog, bindingsResult.bindings);

const short = { productType: "UF-side-cabinet", Drawers: "1D", Handle: "UG", Height: 91 };
const tall = { productType: "UF-side-cabinet", Drawers: "2D", Handle: "UG", Height: 91 };

afterEach(() => setSteppedSceneProducts(null));

describe("stepped scene products", () => {
  it("changes nothing while the collection declares none", () => {
    expect(isSteppedSceneConfig(short)).toBe(false);
    expect(withSteppedSceneHeight(short, "UF-side-cabinet")).toBe(short);
    expect(touchesSteppedHeight({ Height: 91 })).toBe(false);
  });

  it("knows the short cabinet by its scene type and drawers, and its height by the handle", () => {
    setSteppedSceneProducts(stepped);

    expect(isSteppedSceneConfig(short)).toBe(true);
    expect(isSteppedSceneConfig(tall)).toBe(false);
    expect(isSteppedSceneConfig({ ...short, productType: "UF-sink-cabinet" })).toBe(false);
    expect(steppedSceneHeightOf(short)).toBe(56);
    expect(steppedSceneHeightOf({ ...short, Handle: "PTO" })).toBe(53);
    expect(steppedSceneHeightOf({ ...short, Handle: "CG" })).toBe(56);
    // A page reads the products of the bindings it holds.
    setSteppedSceneProducts(null);
    expect(isSteppedSceneConfig(short, stepped)).toBe(true);
  });

  it("places the short cabinet at its own height and a tall one at the height it was given", () => {
    setSteppedSceneProducts(stepped);

    const shortConfig = { Drawers: "1D", Handle: "UG", Height: 91 };
    const tallConfig = { Drawers: "2D", Handle: "UG", Height: 91 };
    expect(withSteppedSceneHeight(shortConfig, "UF-side-cabinet")).toEqual({ ...shortConfig, Height: 56 });
    expect(withSteppedSceneHeight(tallConfig, "UF-side-cabinet")).toBe(tallConfig);
    // A preset product names its type.
    expect(withSteppedSceneHeight({ name: "UF-side-cabinet", Drawers: "1D", Handle: "PTO", Height: 88 })).toEqual({
      name: "UF-side-cabinet",
      Drawers: "1D",
      Handle: "PTO",
      Height: 53,
    });
  });

  it("corrects a short cabinet a height or handle command left at the composition's height", async () => {
    setSteppedSceneProducts(stepped);
    expect(touchesSteppedHeight({ Height: 88 })).toBe(true);
    expect(touchesSteppedHeight({ Handle: "PTO" })).toBe(true);
    expect(touchesSteppedHeight({ CabinetColor: "Bianco 0B MT" })).toBe(false);

    const configs: Record<string, Record<string, unknown>> = {
      "UF-side-cabinet-short": { ...short, Handle: "PTO", Height: 88 },
      "UF-sink-cabinet-sb": { productType: "UF-sink-cabinet", Drawers: "2D", Handle: "PTO", Height: 88 },
    };
    expect(resolveSteppedHeightCorrections(configs)).toEqual([{ productId: "UF-side-cabinet-short", height: 53 }]);

    const setConfig = vi.fn(async (id: string, patch: Record<string, unknown>) => {
      configs[id] = { ...configs[id], ...patch };
      return true;
    });
    // The scene's getConfig answers a snapshot behind getAll().
    const getConfig = vi.fn(async (id: string) => ({ getAll: () => configs[id] }));
    await restoreSteppedSceneHeights({ getConfig, setConfig }, Object.keys(configs));

    expect(setConfig).toHaveBeenCalledTimes(1);
    expect(setConfig).toHaveBeenCalledWith("UF-side-cabinet-short", { Height: 53 });
    expect(configs["UF-sink-cabinet-sb"].Height).toBe(88);
  });
});
