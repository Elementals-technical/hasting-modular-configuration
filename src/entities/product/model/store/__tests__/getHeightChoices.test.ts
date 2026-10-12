import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { rootReducer } from "@/app/store/reducer";
import { parseProductProfile, type ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { getHeightChoices } from "@/entities/product/model/store/selectors";
import {
  addProductId,
  replaceCollectionData,
  setActiveCabinetType,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

const parsedUlh = parseProductProfile(ulhProfileDocument);
if (!parsedUlh.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlh.profile;
// Built as the loader builds it, with the scene product of each cabinet type.
const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile, ulhRuntimeBindings);
const ushCatalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, ushProfile);

const UPPER_GROOVE = "handle_urban_topcut";
const PUSH_TO_OPEN = "handle_pto";

type Selection = { cabinetType: string; handle?: string; drawers?: string; placed?: string[] };

const choicesFor = (profile: ProductProfile, cabinetCatalog: ConfiguratorCatalog, selection: Selection) => {
  let state = rootReducer(undefined, { type: "@@INIT" });
  state = rootReducer(state, replaceCollectionData({ profile, cabinetCatalog }));
  state = rootReducer(state, setActiveCabinetType(selection.cabinetType));

  if (selection.handle || selection.drawers) {
    state = rootReducer(
      state,
      setSelectedProductConfig({
        ...(selection.handle ? { Handle: selection.handle } : {}),
        ...(selection.drawers ? { Drawers: selection.drawers } : {}),
      }),
    );
  }

  for (const runtimeId of selection.placed ?? []) state = rootReducer(state, addProductId(runtimeId));

  return getHeightChoices(state);
};

describe("getHeightChoices", () => {
  it("offers an Urban Low Height cabinet with the upper groove 28 and 38 cm", () => {
    expect(
      choicesFor(ulhProfile, ulhCatalog, { cabinetType: "Sink-Base", handle: UPPER_GROOVE, drawers: "1" }),
    ).toEqual([28, 38]);
  });

  it("offers 25 and 35 cm once push-to-open is chosen", () => {
    expect(
      choicesFor(ulhProfile, ulhCatalog, { cabinetType: "Side-Cabinet", handle: PUSH_TO_OPEN, drawers: "1" }),
    ).toEqual([25, 35]);
  });

  it("keeps offering them once cabinets are placed: the composition is resized as a whole", () => {
    expect(
      choicesFor(ulhProfile, ulhCatalog, {
        cabinetType: "Side-Cabinet",
        handle: PUSH_TO_OPEN,
        drawers: "1",
        placed: ["ULH-sink-cabinet-test1", "ULH-Open-Shelf-test2"],
      }),
    ).toEqual([25, 35]);
  });

  it("offers the heights of the upper groove before a handle is chosen, as the rules read them", () => {
    expect(choicesFor(ulhProfile, ulhCatalog, { cabinetType: "Sink-Base" })).toEqual([28, 38]);
  });

  it("offers nothing a placed cabinet cannot take, whatever the handle", () => {
    // A product the catalog does not know leaves the cabinets without a common height.
    expect(
      choicesFor(ulhProfile, ulhCatalog, {
        cabinetType: "Sink-Base",
        handle: UPPER_GROOVE,
        drawers: "1",
        placed: ["Unknown-product-test1"],
      }),
    ).toEqual([]);
  });

  it("offers nothing for an Urban Low Height open shelf: it has no handle to decide its heights", () => {
    expect(choicesFor(ulhProfile, ulhCatalog, { cabinetType: "Open-Shelf" })).toEqual([]);
  });

  it("offers nothing for Urban Standard Height, where the handle and drawers force one height", () => {
    expect(
      choicesFor(ushProfile, ushCatalog, { cabinetType: "Sink-Base", handle: UPPER_GROOVE, drawers: "2" }),
    ).toEqual([]);
    expect(choicesFor(ushProfile, ushCatalog, { cabinetType: "Sink-Base" })).toEqual([]);
    expect(choicesFor(ushProfile, ushCatalog, { cabinetType: "Open-Shelf" })).toEqual([]);
  });

  it("offers nothing until a cabinet type is active", () => {
    const state = rootReducer(
      rootReducer(undefined, { type: "@@INIT" }),
      replaceCollectionData({ profile: ulhProfile, cabinetCatalog: ulhCatalog }),
    );

    expect(getHeightChoices(state)).toEqual([]);
  });
});
