// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { clearHistory, setHistoryBlocked, setHistoryRestoring, undo } from "@/entities/history/model/store/slice";
import { addProductId, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { useAttributeChangeHandler } from "../hooks/useAttributeChangeHandler";
import { readyCollectionFixture } from "./readyCollectionFixture";

// A field's pick through the real command service and the real history: what the undo steps are.

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={readyCollectionFixture}>
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/accessories"]}>{children}</MemoryRouter>
    </Provider>
  </ReadyCollectionContext.Provider>
);

const history = () => store.getState().rootStateUI.history;

describe("undo steps of a field's pick", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setHistoryRestoring(false));
    store.dispatch(setHistoryBlocked(false));
    store.dispatch(clearHistory());
    // A placed cabinet: a composition the history can restore.
    store.dispatch(addProductId("runtime-a"));
  });

  it("takes one step for a new value and none for the value already chosen, which keeps redo", async () => {
    const runtime = createTestRuntimePort();
    const { result } = renderHook(() => useAttributeChangeHandler("TowelBarOption", { runtime: runtime.port }), {
      wrapper,
    });
    const pick = (value: string) =>
      act(async () => {
        expect((await result.current.onChange(value)).status).toBe("applied");
      });

    await pick("Left");
    expect(history().past).toHaveLength(1);

    // Something to redo, as after an undo.
    store.dispatch(undo(await captureSnapshot(store.getState)));
    expect(history().future).toHaveLength(1);

    // The command sends and records the same value again; nothing an undo restores has changed.
    await pick("Left");
    expect(history().past).toEqual([]);
    expect(history().future).toHaveLength(1);

    await pick("Right");
    expect(history().past).toHaveLength(1);
    expect(history().future).toEqual([]);
  });
});
