import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { rootReducer } from "@/app/store/reducer";
import type { RootState } from "@/app/store";
import { parseProductProfile, type ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  replaceCollectionData,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * The height an empty builder starts at. A collection names it as the `defaultValue` of its
 * Height attribute; without one the cabinet table decides, as it always did.
 */

const parsedUlh = parseProductProfile(ulhProfileDocument);
if (!parsedUlh.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlh.profile;
const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile);
const ushCatalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, ushProfile);

const builder = (profile: ProductProfile, cabinetCatalog: ConfiguratorCatalog) => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog }));

  return {
    store,
    height: () => (store.getState() as RootState).rootStateUI.product.selectedDimensions.height,
  };
};

describe("starting height of the cabinet builder", () => {
  it("starts an Urban Low Height cabinet at 38 cm, the height its models stand at", () => {
    const { store, height } = builder(ulhProfile, ulhCatalog);
    store.dispatch(setActiveCabinetType("Sink-Base"));

    expect(height()).toBe(38);
  });

  it("starts at 35 cm when push-to-open is already chosen: the nearest height that handle takes", () => {
    const { store, height } = builder(ulhProfile, ulhCatalog);
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto", Drawers: "1" }));
    store.dispatch(setActiveCabinetType("Sink-Base"));

    expect(height()).toBe(35);
  });

  it("keeps a height the user already chose when the cabinet type changes", () => {
    const { store, height } = builder(ulhProfile, ulhCatalog);
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedDimensions({ height: 28 }));
    store.dispatch(setActiveCabinetType("Side-Cabinet"));

    expect(height()).toBe(28);
  });

  it("leaves Urban Standard Height, which names no default, at the height of its cabinet table", () => {
    const { store, height } = builder(ushProfile, ushCatalog);
    store.dispatch(setActiveCabinetType("Sink-Base"));

    expect(height()).toBe(56);
  });
});
