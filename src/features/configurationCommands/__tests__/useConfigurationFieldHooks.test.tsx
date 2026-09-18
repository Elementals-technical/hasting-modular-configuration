// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ReadyCollectionContext } from "@/entities/collection";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setCabinetColorMaterial,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { useAttributeChangeHandler } from "../hooks/useAttributeChangeHandler";
import { useAvailabilityResets } from "../hooks/useAvailabilityResets";
import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import { readyCollectionFixture } from "./readyCollectionFixture";

const saveSnapshotMock = vi.fn(async () => undefined);

vi.mock("@/entities/history/lib/useHistorySnapshot", () => ({
  useHistorySnapshot: () => saveSnapshotMock,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));

const matrix = {
  rows: [
    {
      cabinet_type: "Sink-Base",
      widths_cm: "60|80",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "1D|2D",
      handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
      supports_height: "50|53|56",
      handle_pto_forced_height_cm: "1D:50|2D:50",
      handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
      handle_urban_botcut_forced_height_cm: "2D:56",
      handle_urban_botcut_requires_drawers: "2D",
    },
  ],
} as unknown as ProductDatatable;

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={readyCollectionFixture}>
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-colors"]}>{children}</MemoryRouter>
    </Provider>
  </ReadyCollectionContext.Provider>
);

beforeEach(() => {
  saveSnapshotMock.mockClear();
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, ushProfile)));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
});

describe("resolveChangeRequest", () => {
  it("addresses a value at the scope its attribute declares", () => {
    expect(resolveChangeRequest(store.getState(), "TowelBarOption", "Left")).toEqual({
      attributeId: "TowelBarOption",
      value: "Left",
      scope: "global",
    });
    expect(resolveChangeRequest(store.getState(), "Thickness", "2.4")).toMatchObject({ scope: "countertop" });
    expect(resolveChangeRequest(store.getState(), "DrawerPanelFluting", "None")).toEqual({
      attributeId: "DrawerPanelFluting",
      value: "None",
      scope: "cabinet",
      cabinetId: "cab-1",
    });
    expect(resolveChangeRequest(store.getState(), "sinkType", "Top_Tekorlux_Rectangular")).toEqual({
      attributeId: "sinkType",
      value: "Top_Tekorlux_Rectangular",
      scope: "basin",
      sinkBaseId: "cab-1",
    });
  });

  it("cannot address a cabinet value without cabinets, or an unknown attribute", () => {
    expect(resolveChangeRequest(store.getState(), "NotAnAttribute", "x")).toBeNull();

    store.dispatch(resetConfiguration());

    expect(resolveChangeRequest(store.getState(), "DrawerPanelFluting", "None")).toBeNull();
  });
});

describe("useAttributeChangeHandler", () => {
  it("runs a picked value through the command service after recording a history step", async () => {
    store.dispatch(setCabinetColorMaterial("LACM"));
    const runtime = createTestRuntimePort();
    const { result } = renderHook(() => useAttributeChangeHandler("DrawerPanelFluting", { runtime: runtime.port }), {
      wrapper,
    });

    let status: string | undefined;
    await act(async () => {
      status = (await result.current.onChange("FlutingVerticalA")).status;
    });

    expect(status).toBe("applied");
    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
    expect(runtime.calls[0][0]).toMatchObject({
      attributeId: "DrawerPanelFluting",
      value: "FlutingVerticalA",
      target: { scope: "cabinet", cabinetId: "cab-1" },
    });
  });

  it("turns a refusal into a notice without a history step or a scene call", async () => {
    store.dispatch(setCabinetColorMaterial("HPL"));
    const runtime = createTestRuntimePort();
    const { result } = renderHook(() => useAttributeChangeHandler("DrawerPanelFluting", { runtime: runtime.port }), {
      wrapper,
    });

    await act(async () => {
      await result.current.onChange("FlutingVerticalA");
    });

    expect(result.current.notice).toBe("Fluting is available only for Lacquer Matte (LACM).");
    expect(saveSnapshotMock).not.toHaveBeenCalled();
    expect(runtime.calls).toHaveLength(0);
  });
});

describe("useAvailabilityResets", () => {
  it("clears an unavailable fluting in the scene once through the command service", async () => {
    store.dispatch(setCabinetColorMaterial("HPL"));
    const runtime = createTestRuntimePort();

    const { rerender } = renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper });

    await waitFor(() => expect(runtime.calls).toHaveLength(1));
    expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
      ["DrawerPanelFluting", ""],
    ]);

    rerender();
    await act(async () => Promise.resolve());

    expect(runtime.calls).toHaveLength(1);
  });

  it("clears an unavailable grain direction", async () => {
    store.dispatch(setCabinetColorMaterial("LACM"));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper });

    await waitFor(() => expect(runtime.calls).toHaveLength(1));
    expect(runtime.calls[0][0]).toMatchObject({ attributeId: "GrainDirection", value: "" });
  });

  it("clears nothing before the collection loads", async () => {
    store.dispatch(setActiveProfile(null));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper });
    await act(async () => Promise.resolve());

    expect(runtime.calls).toHaveLength(0);
  });
});
