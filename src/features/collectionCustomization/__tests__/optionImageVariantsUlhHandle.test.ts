import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../public/collections/urban-low-height/ui.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { rootReducer } from "@/app/store/reducer";
import type { RootState } from "@/app/store";
import { parseProductProfile, validateCustomizationSchema, type CustomizationSchema } from "@/entities/collection";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { selectOptionImageContext } from "@/entities/product/model/store/derivedSelectors";
import {
  commitRuleSelection,
  replaceCollectionData,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { buildChangePlan } from "@/features/configurationCommands/lib/buildChangePlan";

import { resolveOptionImage } from "../lib/optionImageVariants";

/**
 * The Urban Low Height builder cards show the cabinet of the chosen handle: its pictures follow the
 * height (35/25 cm are the push-to-open ones), and the height follows the handle. Both ways of
 * choosing a handle are covered: before any cabinet is placed, and on a placed one (the command).
 */

const parsed = parseProductProfile(ulhProfileDocument);
if (!parsed.ok) throw new Error("Urban Low Height profile must parse");
const profile = parsed.profile;
// Built as the loader builds it, with the scene product of each cabinet type.
const cabinetCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, profile, ulhRuntimeBindings);

const schema = validateCustomizationSchema(ulhUi);
if (!schema.ok) throw new Error("Urban Low Height ui.json must validate");
const { optionImages, optionImageVariants }: CustomizationSchema = schema.schema;

const upperGrooveSinkBase = () => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog }));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1" }));
  store.dispatch(setSelectedDimensions({ height: 38 }));
  return store;
};

const cardPictures = (state: RootState) => {
  const context = selectOptionImageContext(state);
  const picture = (attributeId: string, value: string) =>
    resolveOptionImage({ optionImages, variants: optionImageVariants, attributeId, value, context });

  return { cabinetType: picture("CabinetType", "Sink-Base"), drawers: picture("Drawers", "1") };
};

const PUSH_TO_OPEN = { cabinetType: "images/cabinet/sink-base-pto.png", drawers: "images/cabinet/sink-base-pto.png" };

describe("Urban Low Height builder cards after a handle change", () => {
  it("show the upper-groove cabinet before the change", () => {
    expect(cardPictures(upperGrooveSinkBase().getState() as RootState)).toEqual({
      cabinetType: "images/cabinet/sink-base-upper-groove.png",
      drawers: "images/cabinet/sink-base-upper-groove.png",
    });
  });

  it("show the push-to-open cabinet once push-to-open is chosen for the next cabinet", () => {
    const store = upperGrooveSinkBase();
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto", Drawers: "1" }));

    expect(cardPictures(store.getState() as RootState)).toEqual(PUSH_TO_OPEN);
  });

  it("show the push-to-open cabinet once the placed cabinets take push-to-open", () => {
    const store = upperGrooveSinkBase();
    const result = buildChangePlan({
      attributeId: "Handle",
      value: "handle_pto",
      target: { scope: "cabinet", cabinetId: "cab-1" },
      selection: {
        cabinetType: "Sink-Base",
        width: 60,
        depth: 46,
        height: 38,
        drawers: "1",
        handle: "handle_urban_topcut",
      },
      // The scene names a placed product after its scene product, not its cabinet type.
      selectedProductIds: ["ULH-sink-cabinet-l4dkl0l8x", "ULH-side-cabinet-14f7v5hpm", "ULH-Open-Shelf-mj7srk5g9"],
      catalog: cabinetCatalog,
      profile,
      handleGrooveColor: null,
    });
    if (!result.ok) throw new Error(result.reason);
    const height = result.plan.find(({ attributeId }) => attributeId === "Height")?.value;
    store.dispatch(commitRuleSelection({ handle: "handle_pto", ...(typeof height === "number" ? { height } : {}) }));

    expect(cardPictures(store.getState() as RootState)).toEqual(PUSH_TO_OPEN);
  });
});
