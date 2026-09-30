// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import classManifestDocument from "../../../../../public/collections/class/manifest.json";
import classPresetsDocument from "../../../../../public/collections/class/presets.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import classUiDocument from "../../../../../public/collections/class/ui.json";
import makoManifestDocument from "../../../../../public/collections/mako/manifest.json";
import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import makoUiDocument from "../../../../../public/collections/mako/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext, type ProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import {
  clearRestore,
  getAttributeValue,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  type ConfigurationRecord,
} from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { getCountertopStyle, getProductsPresets, getSinkType } from "@/entities/product/model/store/selectors";
import { reset, setActiveBasinStyle, setActiveProfile } from "@/entities/product/model/store/slice";
import type { AttributeChange } from "@/features/configurationCommands";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { FieldsStepPage } from "@/pages/fieldsStep/FieldsStepPage";
import { ModelPage } from "@/pages/prebuilt/model/ModelPage";

/**
 * The model page keeps the countertop the configuration prices in step with the one it shows, for
 * Mako and Class, whose scene has no basin (sinkType is state-only):
 * - a Prebuilt order opened from its link keeps its basin and style: the placed cabinets carry the
 *   scene's own default basin, so the ones saved with the order are restored;
 * - Customize on a model card starts Custom from the basin and style the page falls back to.
 */

const mocks = vi.hoisted(() => ({
  record: null as ConfigurationRecord | null,
  changes: [] as AttributeChange[],
  sceneReady: true,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => mocks.sceneReady }));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({
  useCompactAccordionViewport: () => false,
  useShouldCollapseAccordionByDefault: () => false,
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
      // The scene names a rebuilt product after its scene type, so the Sink Base is read as one.
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
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => null) }));
// The page's own command service; the changes a field sends are recorded.
vi.mock("@/features/configurationCommands/hooks/useChangeAttribute", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands/hooks/useChangeAttribute")>();
  const { useMemo } = await import("react");
  return {
    useChangeAttribute: (options?: Parameters<typeof actual.useChangeAttribute>[0]) => {
      const runner = actual.useChangeAttribute(options);
      return useMemo(
        () => ({
          ...runner,
          change: (request: AttributeChange) => {
            mocks.changes.push(request);
            return runner.change(request);
          },
        }),
        [runner],
      );
    },
  };
});

afterEach(cleanup);

const parsedClassProfile = parseProductProfile(classProfileDocument);
if (!parsedClassProfile.ok) throw new Error("Class profile must parse");

const configuratorGroups = configuratorSchema.parse(configurator9).availableOptions;

type Case = {
  collectionId: string;
  profile: ProductProfile;
  bindings: RuntimeBindingSet;
  sinkBaseSceneType: string;
  manifest: unknown;
  ui: unknown;
  presets: unknown;
  countertopTable: unknown;
};

const CASES: Case[] = [
  {
    collectionId: "mako",
    profile: makoProfile,
    bindings: makoRuntimeBindings,
    sinkBaseSceneType: "Mako-sink-cabinet",
    manifest: makoManifestDocument,
    ui: makoUiDocument,
    presets: makoPresetsDocument,
    countertopTable: datatable577,
  },
  {
    collectionId: "class",
    profile: parsedClassProfile.profile,
    bindings: classRuntimeBindings,
    sinkBaseSceneType: "Class-sink-cabinet",
    manifest: classManifestDocument,
    ui: classUiDocument,
    presets: classPresetsDocument,
    countertopTable: datatable578,
  },
];

/** The collection as loaded; its model cards only where a test opens the model list. */
const readyCollectionOf = (
  { collectionId, manifest, ui, presets, bindings, countertopTable }: Case,
  withModels = false,
) => {
  const collection = buildReadyCollection(collectionId, manifest, ui, withModels ? presets : undefined);
  return {
    ...collection,
    catalog: {
      ...collection.catalog,
      runtimeBindings: bindings,
      configurator: {
        groups: configuratorGroups,
        groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
      },
      countertops: parseCountertopMatrix(countertopDatatableSchema.parse(countertopTable)),
    },
  };
};

type SavedBasin = { style: string; basin: string; vesselColor: string };

const IRIS: SavedBasin = { style: "vessel", basin: "Iris", vesselColor: "Acqua 419 GL" };

/**
 * A 60 cm Sink Base on a black glass top, as Save writes it: the configuration with `saved`, the page
 * with `shown` (the same unless a restore left another one on it), the Sink Base with the scene's basin.
 * That is the scene's own default in an order saved before the basin reached the Mako and Class scene,
 * and the vessel's scene token (Vessel_Iris) since.
 */
const savedOrder = (
  { collectionId, sinkBaseSceneType }: Case,
  saved: SavedBasin,
  shown: SavedBasin = saved,
  sceneBasin = "Top_HPLPrisma",
): ConfigurationRecord => {
  const sourceId = `${sinkBaseSceneType}-aaa111`;
  return {
    configuration: {
      [sourceId]: {
        ProductType: sinkBaseSceneType,
        Width: 60,
        Height: 26,
        Depth: 52,
        Drawers: "1D",
        sinkType: sceneBasin,
      },
    },
    metadata: {
      path: "/prebuilt/countertop",
      orderedProductIds: [sourceId],
      collectionId,
      uiState: {
        CountertopStyle: shown.style,
        sinkType: shown.basin,
        VesselColor: shown.vesselColor,
        CountertopColor: "Nero 433 GL",
        Thickness: "0.5",
      },
      configuration: {
        version: 2,
        collectionId,
        cabinets: [{ stableKey: "cab-1", index: 0 }],
        values: {
          countertop: { CountertopStyle: saved.style, CountertopColor: "Nero 433 GL", Thickness: "0.5" },
          "basin:cab-1": { sinkType: saved.basin, VesselColor: saved.vesselColor },
        },
      },
    },
  };
};

const renderAt = (testCase: Case, path: string, page: ReactElement, withModels = false) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <ReadyCollectionContext.Provider value={readyCollectionOf(testCase, withModels)}>
          {page}
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

describe.each(CASES)("$collectionId: a Prebuilt order opened from its link", (testCase) => {
  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(testCase.profile));
    store.dispatch(setActiveCollectionId(testCase.collectionId));
    store.dispatch(setActiveRuntimeBindings(testCase.bindings));
    mocks.record = savedOrder(testCase, IRIS);
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  const restore = async (configId: string) => {
    renderAt(testCase, `/prebuilt/model?collectionId=${testCase.collectionId}&configId=${configId}`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));
  };

  const openCountertopStep = async () => {
    cleanup();
    renderAt(
      testCase,
      `/prebuilt/countertop?collectionId=${testCase.collectionId}`,
      <FieldsStepPage stepId="countertop" />,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
  };

  it("comes back as a vessel with its Iris, and the Countertop & Basin step keeps them", async () => {
    // The collection starts integrated with VA005, which the restore must not keep.
    expect(getCountertopStyle(store.getState())).toBe("integrated");

    await restore("7001");

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(getSinkType(store.getState())).toBe("Iris");

    await openCountertopStep();

    expect(mocks.changes.filter(({ attributeId }) => attributeId === "sinkType")).toEqual([]);
    expect(getSinkType(store.getState())).toBe("Iris");
  });

  it("comes back as the vessel the configuration holds from an order saved again after a restore", async () => {
    // Before, a restore showed the scene's basin as an integrated VA002 while the configuration, and
    // the price, kept the vessel; a save then wrote the page's with the order.
    mocks.record = savedOrder(testCase, IRIS, { style: "Integrated", basin: "VA002", vesselColor: "Acqua 419 GL" });

    await restore("7002");

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(getSinkType(store.getState())).toBe("Iris");
  });

  it("comes back as a vessel without a basin when saved without one", async () => {
    mocks.record = savedOrder(testCase, { style: "vessel", basin: "", vesselColor: "" });

    await restore("7003");

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(getSinkType(store.getState())).toBe("");

    await openCountertopStep();

    expect(mocks.changes.filter(({ attributeId }) => attributeId === "sinkType")).toEqual([]);
    expect(getSinkType(store.getState())).toBe("");
  });

  it("comes back integrated with the basin it was saved with", async () => {
    mocks.record = savedOrder(testCase, { style: "integrated", basin: "VA002", vesselColor: "" });

    await restore("7004");

    expect(getCountertopStyle(store.getState()).toLowerCase()).toBe("integrated");
    expect(getSinkType(store.getState())).toBe("VA002");
  });

  it("comes back as a vessel with its Iris from an order whose scene holds the vessel's token", async () => {
    mocks.record = savedOrder(testCase, IRIS, IRIS, "Vessel_Iris");

    await restore("7005");

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(getSinkType(store.getState())).toBe("Iris");
  });
});

describe.each(CASES)("$collectionId: Customize on a model card", (testCase) => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(testCase.profile));
    store.dispatch(setActiveCollectionId(testCase.collectionId));
    store.dispatch(setActiveRuntimeBindings(testCase.bindings));
    // The scene is not needed: the page places no model by itself.
    mocks.sceneReady = false;
  });

  it("starts Custom from the basin and style the page falls back to, not an earlier pick", async () => {
    // A basin picked on the Countertop & Basin step is the composition's too.
    store.dispatch(setActiveBasinStyle("VA002"));
    store.dispatch(setAttributeValue({ attributeId: "sinkType", target: { scope: "basin" }, value: "VA002" }));

    renderAt(testCase, `/prebuilt/model?collectionId=${testCase.collectionId}`, <ModelPage />, true);
    fireEvent.click((await screen.findAllByText("Customize"))[0]);
    await waitFor(() => expect(getProductsPresets(store.getState()).length).toBeGreaterThan(0));

    // The model's products carry no basin, so the page falls back to the collection's.
    const state = store.getState();
    expect(getAttributeValue(state, "sinkType", { scope: "basin" })).toBe(getSinkType(state));
    expect(getAttributeValue(state, "CountertopStyle", { scope: "countertop" })).toBe(getCountertopStyle(state));
  });
});
