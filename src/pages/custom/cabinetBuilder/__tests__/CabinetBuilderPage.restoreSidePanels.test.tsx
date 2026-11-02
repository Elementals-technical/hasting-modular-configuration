// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import tricotManifest from "../../../../../public/collections/tricot/manifest.json";
import tricotProfileDocument from "../../../../../public/collections/tricot/product-profile.json";
import tricotBindingsDocument from "../../../../../public/collections/tricot/runtime-bindings.json";
import tricotUi from "../../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, parseRuntimeBindings, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import {
  clearRestore,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import type { ConfigurationRecord } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { getSidePanelLeftStatus, getSidePanelRightStatus } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestSidePanelPort } from "@/features/playCanvasAdapter";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * A Custom configuration opened from its link: a side saved without its panel stays without it,
 * even on an edge that could hold one, so the restored panels and price are the saved ones.
 */

const SOURCE_IDS = ["Tricot-sink-cabinet-aaa111", "Tricot-side-cabinet-bbb222"];

const mocks = vi.hoisted(() => ({
  record: null as ConfigurationRecord | null,
  sidePanels: null as ReturnType<typeof createTestSidePanelPort> | null,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => null) }));
vi.mock("@/utils/functions/playcanvas/getEdgeCabinets", () => ({
  getEdgeCabinets: () => ({
    leftCabinetId: "Tricot-sink-cabinet-rebuilt0",
    rightCabinetId: "Tricot-side-cabinet-rebuilt1",
  }),
}));
vi.mock("@/entities/configuration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/configuration")>()),
  useLazyRestoreConfigurationQuery: () => [() => ({ unwrap: async () => mocks.record })],
}));
vi.mock("@/features/playCanvasAdapter/lib/createSceneRestorer", async () => {
  const { createTestSceneRestorer } = await import("@/features/playCanvasAdapter/lib/testSceneRestorer");
  return {
    createSceneRestorer: () => {
      const scene = createTestSceneRestorer();
      // The scene names a rebuilt product after its scene type.
      scene.answerWith(({ products }) => {
        const matches = products.map(({ sourceId, productType }, index) => ({
          sourceId,
          runtimeId: `${productType}-rebuilt${index}`,
        }));
        return {
          status: "restored",
          matches,
          scene: { status: "ready", order: matches.map(({ runtimeId }) => runtimeId), cabinets: [] },
        };
      });
      return scene.restorer;
    },
  };
});
vi.mock("@/features/playCanvasAdapter/lib/createSidePanelPort", async () => {
  const { createTestSidePanelPort: createPort } = await import("@/features/playCanvasAdapter/lib/testSidePanelPort");
  return {
    createSidePanelPort: () => {
      mocks.sidePanels ??= createPort();
      return mocks.sidePanels.port;
    },
  };
});
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createCompositionPort: () => adapter.createTestCompositionPort([]).port,
    createPlayCanvasRuntimePort: () => adapter.createTestRuntimePort().port,
  };
});
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const parsedProfile = parseProductProfile(tricotProfileDocument);
const parsedBindings = parseRuntimeBindings(tricotBindingsDocument);
if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("the packaged Tricot data must parse");

const tricotCollection = buildReadyCollection("tricot", tricotManifest, tricotUi);

const savedConfiguration = (): ConfigurationRecord => ({
  configuration: {
    [SOURCE_IDS[0]]: { ProductType: "Tricot-sink-cabinet", Width: 60, Height: 40, Depth: 52, Drawers: "1DW" },
    [SOURCE_IDS[1]]: { ProductType: "Tricot-side-cabinet", Width: 60, Height: 40, Depth: 52, Drawers: "1DW" },
  },
  metadata: {
    path: "/custom/summary",
    orderedProductIds: SOURCE_IDS,
    collectionId: "tricot",
    uiState: { SidePanels: "NoG", SidePanelLeft: "active", SidePanelRight: "auto-removed" },
    configuration: {
      version: 2,
      collectionId: "tricot",
      cabinets: [
        { stableKey: "cab-1", index: 0 },
        { stableKey: "cab-2", index: 1 },
      ],
      values: {},
    },
  },
});

describe("a Custom Tricot configuration opened from its link", () => {
  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(parsedProfile.profile));
    store.dispatch(setActiveCollectionId("tricot"));
    store.dispatch(setActiveRuntimeBindings(parsedBindings.bindings));
    mocks.record = savedConfiguration();
    mocks.sidePanels = null;
  });

  afterEach(cleanup);

  it("comes back without the panel of a side saved without it, on an edge that could hold one", async () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=tricot&configId=7601"]}>
          <ReadyCollectionContext.Provider value={tricotCollection}>
            <CabinetBuilderPage />
          </ReadyCollectionContext.Provider>
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    expect(getSidePanelLeftStatus(store.getState())).toBe("active");
    expect(getSidePanelRightStatus(store.getState())).toBe("none");
    const placed = mocks.sidePanels?.calls.flatMap(({ placements }) => placements) ?? [];
    expect(placed.filter(({ panel }) => panel !== "None")).toEqual([{ panel: "NoG", side: "left" }]);
  });
});
