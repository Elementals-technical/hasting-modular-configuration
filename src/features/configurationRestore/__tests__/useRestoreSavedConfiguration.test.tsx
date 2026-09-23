// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import {
  clearRestore,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
} from "@/entities/configuration";
import type { ConfigurationRecord } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { addProductId, reset, resetProducts } from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import type { RestorePlan } from "../lib/buildRestorePlan";
import { useRestoreSavedConfiguration } from "../hooks/useRestoreSavedConfiguration";

const USH = "urban-standard-height";
const CONFIG_ID = "13507";

const record: ConfigurationRecord = {
  configuration: {
    "Sink-Base-aaa111": { ProductType: "Sink-Base", Width: 60 },
    "Top_Solid-ccc333": { productType: "Top_Solid", Width: 60 },
  },
  metadata: {
    path: "/custom/summary",
    orderedProductIds: ["Sink-Base-aaa111", "Top_Solid-ccc333"],
    collectionId: USH,
    uiState: {},
    configuration: { version: 2, collectionId: USH, cabinets: [{ stableKey: "cab-1", index: 0 }], values: {} },
  },
};

const mocks = vi.hoisted(() => ({
  canvasReady: true,
  loadRecord: vi.fn(),
  sceneRequests: [] as unknown[],
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({
  usePlayCanvasReady: () => mocks.canvasReady,
}));

vi.mock("@/entities/configuration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/configuration")>()),
  useLazyRestoreConfigurationQuery: () => [(id: string) => ({ unwrap: () => mocks.loadRecord(id) })],
}));

vi.mock("@/features/playCanvasAdapter/lib/createSceneRestorer", async () => {
  const { createTestSceneRestorer } = await import("@/features/playCanvasAdapter/lib/testSceneRestorer");
  return {
    createSceneRestorer: () => {
      const scene = createTestSceneRestorer();
      return {
        ...scene.restorer,
        restore: (...args: Parameters<typeof scene.restorer.restore>) => {
          mocks.sceneRequests.push(args);
          return scene.restorer.restore(...args);
        },
      };
    },
  };
});

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: vi.fn(async () => ({ updatedIds: [] })),
  runInBatchQueue: vi.fn(async (task: () => Promise<unknown>) => task()),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async () => ({ Width: 60 })),
}));

/** Like a page: records the rebuilt products as its composition. */
const applyPage = vi.fn(async (_plan: RestorePlan, matches: { runtimeId: string }[]) => {
  store.dispatch(resetProducts());
  matches.forEach(({ runtimeId }) => store.dispatch(addProductId(runtimeId)));
});

const RestoringPage = ({ configId }: { configId: string | null }) => {
  useRestoreSavedConfiguration({ configId, applyPage });
  return null;
};

const renderPage = (configId: string | null = CONFIG_ID) =>
  render(
    <StrictMode>
      <ReadyCollectionContext.Provider value={readyCollectionFixture}>
        <Provider store={store}>
          <RestoringPage configId={configId} />
        </Provider>
      </ReadyCollectionContext.Provider>
    </StrictMode>,
  );

describe("useRestoreSavedConfiguration", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveCollectionId(USH));
    mocks.canvasReady = true;
    mocks.loadRecord.mockReset();
    mocks.loadRecord.mockResolvedValue(record);
    mocks.sceneRequests.length = 0;
    applyPage.mockClear();
  });

  it("restores once under StrictMode, whose double effect would otherwise start a second restore", async () => {
    renderPage();

    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));
    expect(mocks.loadRecord).toHaveBeenCalledTimes(1);
    expect(mocks.sceneRequests).toHaveLength(1);
    expect(applyPage).toHaveBeenCalledTimes(1);
  });

  it("does not restore again when the page remounts with the same link", async () => {
    const first = renderPage();
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    first.unmount();
    renderPage();
    await Promise.resolve();

    expect(mocks.loadRecord).toHaveBeenCalledTimes(1);
    expect(mocks.sceneRequests).toHaveLength(1);
    expect(applyPage).toHaveBeenCalledTimes(1);
  });

  it("waits for the scene, then restores once", async () => {
    mocks.canvasReady = false;
    const page = renderPage();
    await Promise.resolve();

    expect(mocks.loadRecord).not.toHaveBeenCalled();

    mocks.canvasReady = true;
    page.rerender(
      <StrictMode>
        <ReadyCollectionContext.Provider value={readyCollectionFixture}>
          <Provider store={store}>
            <RestoringPage configId={CONFIG_ID} />
          </Provider>
        </ReadyCollectionContext.Provider>
      </StrictMode>,
    );

    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));
    expect(mocks.loadRecord).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a saved configuration in the link", async () => {
    renderPage(null);
    await Promise.resolve();

    expect(mocks.loadRecord).not.toHaveBeenCalled();
    expect(getRestoreState(store.getState()).status).toBe("idle");
  });
});
