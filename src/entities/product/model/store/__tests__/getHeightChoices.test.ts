import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../../../public/collections/urban-duplex/runtime-bindings.json";
import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import cabinetTable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import { rootReducer } from "@/app/store/reducer";
import { parseProductProfile, parseRuntimeBindings, type ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { getCabinetEntries, setAttributeValue, syncCabinets } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { getHeightChoices } from "@/entities/product/model/store/selectors";
import { selectPlacedSeriesCabinets, selectPlacedSeriesHeights } from "@/entities/product/model/store/seriesCabinets";
import {
  addProductId,
  recordComposition,
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

const parsedDuplex = parseProductProfile(urbanDuplexProfileDocument);
const parsedDuplexBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedDuplex.ok || !parsedDuplexBindings.ok) throw new Error("Urban Duplex data must parse");
const duplexProfile = parsedDuplex.profile;
const duplexCatalog = buildCabinetCatalogFromMatrix(
  cabinetTable594 as ProductDatatable,
  duplexProfile,
  parsedDuplexBindings.bindings,
);

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

  it("offers an Urban Duplex one-drawer cabinet 53 cm and the Slim 38 and 28 cm", () => {
    expect(choicesFor(duplexProfile, duplexCatalog, { cabinetType: "Sink-Base", handle: "UG", drawers: "1D" })).toEqual(
      [28, 38, 53],
    );
    expect(
      choicesFor(duplexProfile, duplexCatalog, {
        cabinetType: "Sink-Cabinet",
        handle: "UG",
        drawers: "1D",
        placed: ["UD-sink-cabinet-test1", "UD-open-shelves-side-test2"],
      }),
    ).toEqual([28, 38, 53]);
  });

  it("offers nothing for the Urban Duplex styles with one height, nor for its shelves", () => {
    expect(choicesFor(duplexProfile, duplexCatalog, { cabinetType: "Sink-Base", handle: "UG", drawers: "2D" })).toEqual(
      [],
    );
    expect(
      choicesFor(duplexProfile, duplexCatalog, { cabinetType: "Sink-Base", handle: "UG", drawers: "1DWID" }),
    ).toEqual([]);
    expect(choicesFor(duplexProfile, duplexCatalog, { cabinetType: "Open-Shelf" })).toEqual([]);
    expect(choicesFor(duplexProfile, duplexCatalog, { cabinetType: "Side-Shelf" })).toEqual([]);
  });

  it("offers nothing until a cabinet type is active", () => {
    const state = rootReducer(
      rootReducer(undefined, { type: "@@INIT" }),
      replaceCollectionData({ profile: ulhProfile, cabinetCatalog: ulhCatalog }),
    );

    expect(getHeightChoices(state)).toEqual([]);
  });
});

/**
 * An Urban Duplex composition with a side cabinet Urban Standard Height or Urban Low Height
 * supplies. The cabinets share a height, and that cabinet comes in the heights of its series only.
 */
describe("the heights beside a cabinet of another series", () => {
  const SINK_BASE = "UD-sink-cabinet-test1";
  const SIDE_CABINET = "UD-side-cabinet-test2";

  /** A one-drawer sink base and a side cabinet of `series`; one more one-drawer cabinet is being added. */
  const withSideCabinetOf = (series: string) => {
    let state = rootReducer(undefined, { type: "@@INIT" });
    state = rootReducer(state, replaceCollectionData({ profile: duplexProfile, cabinetCatalog: duplexCatalog }));
    state = rootReducer(
      state,
      recordComposition({
        productIds: [SINK_BASE, SIDE_CABINET],
        placedCabinetStyles: { [SINK_BASE]: "1", [SIDE_CABINET]: "1" },
      }),
    );
    state = rootReducer(state, syncCabinets([SINK_BASE, SIDE_CABINET]));
    const [sinkBase, sideCabinet] = getCabinetEntries(state);
    for (const [cabinet, value] of [
      [sinkBase, "URDPX"],
      [sideCabinet, series],
    ] as const) {
      state = rootReducer(
        state,
        setAttributeValue({ attributeId: "Series", target: { scope: "cabinet", cabinetId: cabinet.stableKey }, value }),
      );
    }
    state = rootReducer(state, setActiveCabinetType("Sink-Cabinet"));
    return rootReducer(state, setSelectedProductConfig({ Handle: "UG", Drawers: "1D" }));
  };

  it("finds the cabinet by the series the state holds for it, with the rule of that series", () => {
    const placed = selectPlacedSeriesCabinets(withSideCabinetOf("URLH"));

    expect(placed).toEqual([
      {
        runtimeId: SIDE_CABINET,
        drawers: "1",
        rule: expect.objectContaining({ code: "Sink-Cabinet", series: "URLH" }),
      },
    ]);
    // The collection's own cabinets are not among them.
    expect(selectPlacedSeriesCabinets(withSideCabinetOf("URDPX"))).toEqual([]);
    expect(selectPlacedSeriesHeights(withSideCabinetOf("URDPX"))).toBeNull();
  });

  it("keeps the composition at 53 cm beside an Urban Standard Height one-drawer cabinet", () => {
    const state = withSideCabinetOf("URSTD");

    expect(selectPlacedSeriesHeights(state)).toEqual([53]);
    // One height is left, so there is nothing to choose.
    expect(getHeightChoices(state)).toEqual([]);
  });

  it("leaves the Slim heights beside an Urban Low Height cabinet", () => {
    const state = withSideCabinetOf("URLH");

    expect(selectPlacedSeriesHeights(state)).toEqual([38, 28]);
    expect(getHeightChoices(state)).toEqual([28, 38]);
  });

  it("leaves all three heights of one drawer while every cabinet is the collection's own", () => {
    expect(getHeightChoices(withSideCabinetOf("URDPX"))).toEqual([28, 38, 53]);
  });
});
