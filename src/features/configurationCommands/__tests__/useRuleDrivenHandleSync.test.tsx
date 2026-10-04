// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import {
  addProductId,
  commitRuleSelection,
  reset,
  restoreProductState,
  setActiveProfile,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { useRuleDrivenHandleSync } from "../hooks/useRuleDrivenHandleSync";
import { readyCollectionFixture } from "./readyCollectionFixture";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={readyCollectionFixture}>
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder"]}>{children}</MemoryRouter>
    </Provider>
  </ReadyCollectionContext.Provider>
);

const sentValues = (runtime: ReturnType<typeof createTestRuntimePort>) =>
  runtime.calls.map((set) => set.map(({ attributeId, value }) => [attributeId, value]));

describe("useRuleDrivenHandleSync", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
  });

  it("sends a handle the state changed on its own to the scene once, with the groove reset", async () => {
    const runtime = createTestRuntimePort();
    renderHook(() => useRuleDrivenHandleSync({ runtime: runtime.port }), { wrapper });

    act(() => {
      store.dispatch(addProductId("rt-a"));
      store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));
    });

    await waitFor(() => expect(runtime.calls).toHaveLength(1));
    expect(sentValues(runtime)).toEqual([
      [
        ["Handle", "handle_pto"],
        ["HandleGrooveColor", "None"],
      ],
    ]);
  });

  it("does not send a handle the command service or an undo already applied", async () => {
    const runtime = createTestRuntimePort();
    renderHook(() => useRuleDrivenHandleSync({ runtime: runtime.port }), { wrapper });

    act(() => {
      store.dispatch(addProductId("rt-a"));
      store.dispatch(commitRuleSelection({ handle: "handle_pto" }));
      store.dispatch(
        restoreProductState({
          productIds: ["rt-b"],
          productOptions: store.getState().rootStateUI.product.productOptions,
          activeCabinetType: "Sink-Base",
          selectedDimensions: { width: 60, height: 53, depth: 46 },
          selectedProductConfig: { Handle: "handle_urban_topcut" },
          productsPresets: [],
        }),
      );
    });
    await act(async () => Promise.resolve());

    expect(runtime.calls).toHaveLength(0);
  });

  it("has nothing to send while no product is placed, or once unmounted", async () => {
    const runtime = createTestRuntimePort();
    const { unmount } = renderHook(() => useRuleDrivenHandleSync({ runtime: runtime.port }), { wrapper });

    act(() => {
      store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));
    });
    unmount();
    act(() => {
      store.dispatch(addProductId("rt-a"));
      store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut" }));
    });
    await act(async () => Promise.resolve());

    expect(runtime.calls).toHaveLength(0);
  });
});
