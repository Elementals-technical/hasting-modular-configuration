import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { rootReducer } from "@/app/store/reducer";
import type { RootState } from "@/app/store";
import { parseProductProfile } from "@/entities/collection";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  commitRuleSelection,
  replaceCollectionData,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSidePanelsOption,
} from "@/entities/product/model/store/slice";
import { buildChangePlan } from "@/features/configurationCommands/lib/buildChangePlan";

import { getSidePanelsOption, selectSidePanelAvailability } from "../../model/selectors";
import { resolveGroove } from "../sidePanelService";

/**
 * An Urban Low Height cabinet takes the heights of its handle (upper groove 38/28 cm, push-to-open
 * 35/25 cm), so a handle change moves the height, and the side panels follow it: push-to-open has
 * no groove. The change goes the way the command applies it: the plan, then one commitRuleSelection
 * that the side panel listener reacts to.
 */

const parsed = parseProductProfile(ulhProfileDocument);
if (!parsed.ok) throw new Error("Urban Low Height profile must parse");
const profile = parsed.profile;
// Built as the loader builds it, with the scene product of each cabinet type.
const cabinetCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, profile, ulhRuntimeBindings);

/** The height the command plans with a handle change on a Sink Base at 38 cm with the upper groove. */
const plannedHeight = (handle: string): number | undefined => {
  const result = buildChangePlan({
    attributeId: "Handle",
    value: handle,
    target: { scope: "cabinet", cabinetId: "cab-1" },
    selection: {
      cabinetType: "Sink-Base",
      width: 60,
      depth: 46,
      height: 38,
      drawers: "1",
      handle: "handle_urban_topcut",
    },
    // The placed cabinets, named after their scene products as the scene names them.
    selectedProductIds: ["ULH-sink-cabinet-l4dkl0l8x", "ULH-side-cabinet-14f7v5hpm"],
    catalog: cabinetCatalog,
    profile,
    handleGrooveColor: null,
  });
  if (!result.ok) throw new Error(result.reason);

  const height = result.plan.find(({ attributeId }) => attributeId === "Height")?.value;
  return typeof height === "number" ? height : undefined;
};

/** The groove the side panel listener settles on once the handle change is committed. */
const grooveAfterHandle = (handle: string) => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog }));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1" }));
  store.dispatch(setSelectedDimensions({ height: 38 }));
  store.dispatch(setSidePanelsOption("UpperG"));

  const height = plannedHeight(handle);
  store.dispatch(commitRuleSelection({ handle, ...(height === undefined ? {} : { height }) }));

  const state = store.getState() as RootState;
  return resolveGroove(
    selectSidePanelAvailability(state).allowed as Set<string>,
    getSidePanelsOption(state),
    handle,
    profile,
  );
};

describe("Urban Low Height handle change", () => {
  it("moves the cabinet to the first push-to-open height, 35 cm", () => {
    expect(plannedHeight("handle_pto")).toBe(35);
  });

  it("drops the upper groove of the side panels for push-to-open, which has no groove", () => {
    expect(grooveAfterHandle("handle_pto")).toBe("NoG");
  });

  it("keeps the height and the upper groove while the handle stays the upper groove", () => {
    expect(plannedHeight("handle_urban_topcut")).toBeUndefined();
    expect(grooveAfterHandle("handle_urban_topcut")).toBe("UpperG");
  });
});
