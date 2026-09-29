import { describe, expect, it } from "vitest";

import { rootReducer } from "@/app/store/reducer";
import { getCabinetBuilderProductConfig } from "@/entities/product/model/store/selectors";
import {
  setActiveCountertopColor,
  setCabinetColor,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

const initialState = () => rootReducer(undefined, { type: "@@INIT" });

describe("getCabinetBuilderProductConfig", () => {
  it("keeps Add and debug placement gated until every selected dimension is available", () => {
    let state = initialState();
    state = rootReducer(state, setSelectedProductConfig({ ProductType: "test-cabinet", Width: 30 }));
    state = rootReducer(state, setSelectedDimensions({ width: 60, height: 28 }));

    expect(getCabinetBuilderProductConfig(state)).toBeNull();
  });

  it("matches the sidebar Add merge and prefers current dimensions and materials over stale config fields", () => {
    let state = initialState();
    state = rootReducer(
      state,
      setSelectedProductConfig({
        ProductType: "test-cabinet",
        Drawers: "1DW",
        Width: 30,
        Height: 20,
        Depth: 35,
        CabinetColor: "stale cabinet color",
        CountertopColor: "stale countertop color",
        HandleGrooveColor: "stale groove color",
        DrawerPanelFluting: "stale fluting",
        GrainDirection: "stale grain",
      }),
    );
    state = rootReducer(state, setSelectedDimensions({ width: 80, height: 28, depth: 46 }));
    state = rootReducer(state, setCabinetColor("current cabinet material"));
    state = rootReducer(state, setActiveCountertopColor("current countertop material"));
    state = rootReducer(state, setHandleGrooveColor("current groove color"));
    state = rootReducer(state, setDrawerPanelFluting("current fluting"));
    state = rootReducer(state, setGrainDirection("current grain"));

    const product = state.rootStateUI.product;
    const sidebarEquivalent = {
      ...product.selectedProductConfig,
      Width: product.selectedDimensions.width,
      Height: product.selectedDimensions.height,
      Depth: product.selectedDimensions.depth,
      CabinetColor: product.productOptions.CabinetColor,
      CountertopColor: product.productOptions.CountertopColor,
      HandleGrooveColor: product.productOptions.HandleGrooveColor,
      DrawerPanelFluting: product.productOptions.DrawerPanelFluting,
      GrainDirection: product.productOptions.GrainDirection,
    };
    const selected = getCabinetBuilderProductConfig(state);

    expect(selected).toEqual(sidebarEquivalent);
    expect(selected).toMatchObject({
      ProductType: "test-cabinet",
      Drawers: "1DW",
      Width: 80,
      Height: 28,
      Depth: 46,
      CabinetColor: "current cabinet material",
      CountertopColor: "current countertop material",
      HandleGrooveColor: "current groove color",
      DrawerPanelFluting: "current fluting",
      GrainDirection: "current grain",
    });
    expect(getCabinetBuilderProductConfig(state)).toBe(selected);
  });
});
