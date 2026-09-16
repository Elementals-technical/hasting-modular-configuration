// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ActiveCollectionContext } from "@/entities/collection";
import type { ActiveCollectionState } from "@/entities/collection";
import { clearRestore, getRestoreState, startRestore } from "@/entities/configuration";

import { useRestoreSavedConfiguration } from "../hooks/useRestoreSavedConfiguration";

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));

const failedCollection: ActiveCollectionState = {
  status: "error",
  collectionId: "unknown",
  error: { code: "unknown-collection", message: "Unknown collection: unknown" },
};

const renderWithCollection = (collection: ActiveCollectionState, configId: string | null) => {
  const applyPage = vi.fn(async () => undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <ActiveCollectionContext.Provider value={collection}>{children}</ActiveCollectionContext.Provider>
    </Provider>
  );

  renderHook(() => useRestoreSavedConfiguration({ configId, applyPage }), { wrapper });
  return { applyPage };
};

describe("useRestoreSavedConfiguration", () => {
  beforeEach(() => {
    store.dispatch(clearRestore());
  });

  it("reports a collection that failed to load instead of waiting, without restoring", () => {
    const { applyPage } = renderWithCollection(failedCollection, "13507");

    expect(getRestoreState(store.getState())).toEqual({
      configId: "13507",
      status: "failed",
      reason: "collection",
      message: "Unknown collection: unknown",
    });
    expect(applyPage).not.toHaveBeenCalled();
  });

  it("does not overwrite a restore of the same configuration that already started", () => {
    store.dispatch(startRestore("13507"));

    renderWithCollection(failedCollection, "13507");

    expect(getRestoreState(store.getState()).status).toBe("restoring");
  });

  it("does nothing without a configuration to restore", () => {
    renderWithCollection(failedCollection, null);

    expect(getRestoreState(store.getState()).status).toBe("idle");
  });
});
