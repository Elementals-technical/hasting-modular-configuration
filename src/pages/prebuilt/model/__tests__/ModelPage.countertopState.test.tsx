// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import tricotManifestDocument from "../../../../../public/collections/tricot/manifest.json";
import tricotPresetsDocument from "../../../../../public/collections/tricot/presets.json";
import tricotUiDocument from "../../../../../public/collections/tricot/ui.json";
import ulhManifestDocument from "../../../../../public/collections/urban-low-height/manifest.json";
import ulhPresetsDocument from "../../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUiDocument from "../../../../../public/collections/urban-low-height/ui.json";
import udManifestDocument from "../../../../../public/collections/urban-duplex/manifest.json";
import udPresetsDocument from "../../../../../public/collections/urban-duplex/presets.json";
import udProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import udBindingsDocument from "../../../../../public/collections/urban-duplex/runtime-bindings.json";
import udUiDocument from "../../../../../public/collections/urban-duplex/ui.json";
import ushManifestDocument from "../../../../../public/collections/urban-standard-height/manifest.json";
import ushPresetsDocument from "../../../../../public/collections/urban-standard-height/presets.json";
import ushUiDocument from "../../../../../public/collections/urban-standard-height/ui.json";
import { store } from "@/app/store";
import {
  parseProductProfile,
  parseRuntimeBindings,
  ReadyCollectionContext,
  type ProductProfile,
} from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import datatable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import datatable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable593 from "@/entities/collection/__tests__/fixtures/remote/datatable-593.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { tricotMatrixProfile, tricotRuntimeBindings } from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import {
  clearRestore,
  getAttributeValue,
  setExplicitUserChoice,
  getRestoreState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  type ConfigurationRecord,
} from "@/entities/configuration";
import type { ConfigurationSidePanelPort } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import type { ProductDatatable } from "@/entities/product/api";
import { arePrebuiltModelPresetsEqual } from "@/entities/product/lib/arePrebuiltModelPresetsEqual";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  getCountertopStyle,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getProductsPresets,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { reset, setActiveBasinStyle, setActiveProfile } from "@/entities/product/model/store/slice";
import { recordValues, type AttributeChange } from "@/features/configurationCommands";
import {
  createTestCompositionPort,
  createTestRuntimePort,
  createTestSidePanelPort,
} from "@/features/playCanvasAdapter";
import type { UseChangeAttributeOptions } from "@/features/configurationCommands/hooks/useChangeAttribute";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { FieldsStepPage } from "@/pages/fieldsStep/FieldsStepPage";
import { ModelPage } from "@/pages/prebuilt/model/ModelPage";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import type { EdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";

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
  ports: null as UseChangeAttributeOptions | null,
  sidePanelPort: null as ConfigurationSidePanelPort | null,
  edgeCabinets: { leftCabinetId: null, rightCabinetId: null } as EdgeCabinets,
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
vi.mock("@/utils/functions/playcanvas/getEdgeCabinets", () => ({ getEdgeCabinets: () => mocks.edgeCabinets }));
vi.mock("@/features/playCanvasAdapter/lib/createSidePanelPort", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/playCanvasAdapter/lib/createSidePanelPort")>();
  return { createSidePanelPort: () => mocks.sidePanelPort ?? actual.createSidePanelPort() };
});
// The page's own command service; the changes a field sends are recorded.
vi.mock("@/features/configurationCommands/hooks/useChangeAttribute", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands/hooks/useChangeAttribute")>();
  const { useMemo } = await import("react");
  return {
    useChangeAttribute: (options?: Parameters<typeof actual.useChangeAttribute>[0]) => {
      const runner = actual.useChangeAttribute({ ...options, ...mocks.ports });
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

afterEach(() => {
  cleanup();
  mocks.ports = null;
  mocks.sidePanelPort = null;
  mocks.edgeCabinets = { leftCabinetId: null, rightCabinetId: null };
});

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
  cabinets?: ConfiguratorCatalog;
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
  { collectionId, manifest, ui, presets, bindings, countertopTable, cabinets }: Case,
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
      ...(cabinets ? { cabinets } : {}),
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
  uiState: Record<string, string> = {},
  cabinetValues?: Record<string, string>,
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
        ...uiState,
      },
      configuration: {
        version: 2,
        collectionId,
        cabinets: [{ stableKey: "cab-1", index: 0 }],
        values: {
          countertop: { CountertopStyle: saved.style, CountertopColor: "Nero 433 GL", Thickness: "0.5" },
          "basin:cab-1": { sinkType: saved.basin, VesselColor: saved.vesselColor },
          ...(cabinetValues ? { "cabinet:cab-1": cabinetValues } : {}),
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
    // The collection starts integrated with LV890, which the restore must not keep.
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

describe("urban-low-height: a Prebuilt order opened from its link keeps its handle", () => {
  const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
  if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");
  const ulh: Case = {
    collectionId: "urban-low-height",
    profile: parsedUlhProfile.profile,
    bindings: ulhRuntimeBindings,
    sinkBaseSceneType: "ULH-sink-cabinet",
    manifest: ulhManifestDocument,
    ui: ulhUiDocument,
    presets: ulhPresetsDocument,
    countertopTable: datatable589,
  };

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(ulh.profile));
    store.dispatch(setActiveCollectionId(ulh.collectionId));
    store.dispatch(setActiveRuntimeBindings(ulh.bindings));
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  it("chooses the handle saved at the first cabinet, which the cabinets after it are priced with", async () => {
    // Two sink bases; the commands recorded the composition's handle once, at the first cabinet.
    const sourceIds = ["ULH-sink-cabinet-aaa111", "ULH-sink-cabinet-bbb222"];
    mocks.record = {
      configuration: Object.fromEntries(
        sourceIds.map((sourceId) => [
          sourceId,
          { ProductType: "ULH-sink-cabinet", Width: 60, Height: 38, Depth: 46, Drawers: "1D" },
        ]),
      ),
      metadata: {
        path: "/prebuilt/model",
        orderedProductIds: sourceIds,
        collectionId: ulh.collectionId,
        uiState: {},
        configuration: {
          version: 2,
          collectionId: ulh.collectionId,
          cabinets: [
            { stableKey: "cab-1", index: 0 },
            { stableKey: "cab-2", index: 1 },
          ],
          values: { "cabinet:cab-1": { Handle: "handle_urban_topcut" } },
        },
      },
    };

    renderAt(ulh, `/prebuilt/model?collectionId=${ulh.collectionId}&configId=7101`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_urban_topcut");
  });

  it("keeps the fluting the Summary shows, from the ui state and at the cabinet that holds it", async () => {
    mocks.record = savedOrder(
      ulh,
      { style: "integrated", basin: "VA002", vesselColor: "" },
      undefined,
      undefined,
      { DrawerPanelFluting: "FlutingVerticalA" },
      { DrawerPanelFluting: "FlutingVerticalA" },
    );

    renderAt(ulh, `/prebuilt/model?collectionId=${ulh.collectionId}&configId=7102`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    expect(getDrawerPanelFluting(store.getState())).toBe("FlutingVerticalA");
    expect(getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-1" })).toBe(
      "FlutingVerticalA",
    );
  });
});

describe("urban-standard-height: a Prebuilt order opened from its link keeps its add-ons and cabinet options", () => {
  const ush: Case = {
    collectionId: "urban-standard-height",
    profile: ushProfile,
    bindings: ushRuntimeBindings,
    sinkBaseSceneType: "Sink-Base",
    manifest: ushManifestDocument,
    ui: ushUiDocument,
    presets: ushPresetsDocument,
    countertopTable: datatable438,
  };
  const INTEGRATED: SavedBasin = { style: "integrated", basin: "VA002", vesselColor: "" };

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(ush.profile));
    store.dispatch(setActiveCollectionId(ush.collectionId));
    store.dispatch(setActiveRuntimeBindings(ush.bindings));
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  const restore = async (configId: string, uiState: Record<string, string>) => {
    const runtime = createTestRuntimePort();
    mocks.ports = { runtime: runtime.port };
    mocks.record = savedOrder(ush, INTEGRATED, INTEGRATED, undefined, uiState);

    renderAt(ush, `/prebuilt/model?collectionId=${ush.collectionId}&configId=${configId}`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    return runtime;
  };

  /** What the page sent the scene for an attribute, in the order it was sent. */
  const sentToScene = (runtime: ReturnType<typeof createTestRuntimePort>, attributeId: string) =>
    runtime.calls.flat().flatMap((change) => (change.attributeId === attributeId ? [change.value] : []));

  it("comes back with both towel bars and their colour, in the state and in the scene", async () => {
    const runtime = await restore("7401", { TowelBarOption: "Both", TowelBarColor: "Carbone 43 MT" });

    expect(getTowelBarOption(store.getState())).toBe("Both");
    expect(getTowelBarColor(store.getState())).toBe("Carbone 43 MT");
    // Sent once: nothing later in the restore takes the bar back out.
    expect(sentToScene(runtime, "TowelBarOption")).toEqual(["Both"]);
    expect(sentToScene(runtime, "TowelBarColor")).toEqual(["Carbone 43 MT"]);
  });

  it("reads the option of a legacy save from the scene's towel bar and its side", async () => {
    const runtime = await restore("7402", {
      TowelBarOption: "TowelBar40_R",
      TowelBarSide: "left",
      TowelBarColor: "Carbone 43 MT",
    });

    expect(getTowelBarOption(store.getState())).toBe("Left");
    expect(sentToScene(runtime, "TowelBarOption")).toEqual(["Left"]);
  });

  it("comes back without a towel bar and without a colour when saved with none", async () => {
    const runtime = await restore("7403", { TowelBarOption: "None", TowelBarColor: "" });

    expect(getTowelBarOption(store.getState())).toBe("None");
    expect(getTowelBarColor(store.getState())).toBe("");
    expect(sentToScene(runtime, "TowelBarOption")).toEqual(["None"]);
    expect(sentToScene(runtime, "TowelBarColor")).toEqual([]);
  });

  it("keeps the option of a towel bar saved without a colour", async () => {
    const runtime = await restore("7404", { TowelBarOption: "Right" });

    expect(getTowelBarOption(store.getState())).toBe("Right");
    expect(getTowelBarColor(store.getState())).toBe("");
    expect(sentToScene(runtime, "TowelBarColor")).toEqual([]);
  });

  it("records the fluting and the grain direction, which the scene already holds", async () => {
    const runtime = await restore("7405", {
      DrawerPanelFluting: "FlutingVerticalA",
      GrainDirection: "GrainVertical",
    });

    expect(getDrawerPanelFluting(store.getState())).toBe("FlutingVerticalA");
    expect(getGrainDirection(store.getState())).toBe("GrainVertical");
    expect(sentToScene(runtime, "DrawerPanelFluting")).toEqual([]);
    expect(sentToScene(runtime, "GrainDirection")).toEqual([]);
  });
});

describe("tricot: a Prebuilt order opened from its link", () => {
  const tricot: Case = {
    collectionId: "tricot",
    profile: tricotMatrixProfile,
    bindings: tricotRuntimeBindings,
    sinkBaseSceneType: "Tricot-sink-cabinet",
    manifest: tricotManifestDocument,
    ui: tricotUiDocument,
    presets: tricotPresetsDocument,
    countertopTable: datatable593,
  };
  const sourceIds = ["Tricot-sink-cabinet-aaa111", "Tricot-side-cabinet-bbb222"];

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(tricot.profile));
    store.dispatch(setActiveCollectionId(tricot.collectionId));
    store.dispatch(setActiveRuntimeBindings(tricot.bindings));
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  it("records the model's groove for pricing before Customize, replacing stale automatic state", async () => {
    const composition = createTestCompositionPort();
    const id = "Tricot-sink-cabinet-placed";
    composition.answerNext({
      status: "applied", placed: [id],
      scene: { status: "ready", order: [id], cabinets: [{ runtimeId: id, dimensions: { width: 60, height: 40, depth: 52 } }] },
    });
    mocks.ports = { composition: composition.port, runtime: createTestRuntimePort().port };
    recordValues({ HandleGrooveColor: "Agata 407 MT" }, { getState: store.getState, dispatch: store.dispatch, flow: "prebuilt" });
    expect(getHandleGrooveColor(store.getState())).toBe("Agata 407 MT");
    renderAt(tricot, "/prebuilt/model?collectionId=tricot&preset=1190388679", <ModelPage />, true);
    await waitFor(() => expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBe(1190388679));
    expect(composition.calls[0]).toMatchObject({ op: "replace", request: { shared: { HandleGrooveColor: "Nero 433 MT" } } });
    expect(getHandleGrooveColor(store.getState())).toBe("Nero 433 MT");
    expect(store.getState().rootStateUI.configuration.explicitUserChoices).toEqual({});
  });

  /** Two cabinets with a pattern each; the ui state holds the last one chosen. */
  const savedWithTwoPatterns = (uiState: Record<string, string> = {}): ConfigurationRecord => ({
    configuration: {
      [sourceIds[0]]: { ProductType: "Tricot-sink-cabinet", Width: 60, Height: 40, Depth: 52, Drawers: "1DW" },
      [sourceIds[1]]: { ProductType: "Tricot-side-cabinet", Width: 60, Height: 40, Depth: 52, Drawers: "1DW" },
    },
    metadata: {
      path: "/prebuilt/summary",
      orderedProductIds: sourceIds,
      collectionId: tricot.collectionId,
      uiState: { CabinetColor: "Noce Canaletto 933", DrawerPanelFluting: "Satin", ...uiState },
      configuration: {
        version: 2,
        collectionId: tricot.collectionId,
        cabinets: [
          { stableKey: "cab-1", index: 0 },
          { stableKey: "cab-2", index: 1 },
        ],
        values: {
          "cabinet:cab-1": { DrawerPanelFluting: "Cannette" },
          "cabinet:cab-2": { DrawerPanelFluting: "Satin" },
        },
      },
    },
  });

  const restore = async (configId: string, uiState?: Record<string, string>) => {
    const runtime = createTestRuntimePort();
    mocks.ports = { runtime: runtime.port };
    mocks.record = savedWithTwoPatterns(uiState);

    renderAt(tricot, `/prebuilt/model?collectionId=${tricot.collectionId}&configId=${configId}`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    return runtime;
  };

  it("keeps each cabinet's pattern for the price and for Customize, and the last one chosen for Summary", async () => {
    await restore("7501");

    expect(getDrawerPanelFluting(store.getState())).toBe("Satin");
    expect(getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-1" })).toBe(
      "Cannette",
    );
    expect(getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-2" })).toBe(
      "Satin",
    );
    expect(getProductsPresets(store.getState()).map(({ DrawerPanelFluting }) => DrawerPanelFluting)).toEqual([
      "Cannette",
      "Satin",
    ]);
    // The colour recorded after the pattern still reaches the presets.
    expect(getProductsPresets(store.getState()).map(({ CabinetColor }) => CabinetColor)).toEqual([
      "Noce Canaletto 933",
      "Noce Canaletto 933",
    ]);
  });

  it("neither sends nor records a towel bar, which the collection does not offer", async () => {
    const optionBefore = getTowelBarOption(store.getState());

    const runtime = await restore("7502", { TowelBarOption: "Both", TowelBarColor: "Carbone 43 MT" });

    expect(runtime.calls.flat().filter(({ attributeId }) => attributeId.startsWith("TowelBar"))).toEqual([]);
    expect(getTowelBarOption(store.getState())).toBe(optionBefore);
    expect(getTowelBarColor(store.getState())).toBe("");
  });

  it("comes back without the panel of a side saved without it, on an edge that could hold one", async () => {
    const sidePanels = createTestSidePanelPort();
    mocks.sidePanelPort = sidePanels.port;
    // The scene names a rebuilt product after its scene type.
    mocks.edgeCabinets = {
      leftCabinetId: "Tricot-sink-cabinet-rebuilt0",
      rightCabinetId: "Tricot-side-cabinet-rebuilt1",
    };

    await restore("7503", { SidePanels: "NoG", SidePanelLeft: "active", SidePanelRight: "auto-removed" });

    expect(getSidePanelLeftStatus(store.getState())).toBe("active");
    expect(getSidePanelRightStatus(store.getState())).toBe("none");
    expect(sidePanels.calls.flatMap(({ placements }) => placements).filter(({ panel }) => panel !== "None")).toEqual([
      { panel: "NoG", side: "left" },
    ]);
  });
});

describe("mako: a Prebuilt order opened from its link keeps its handle and leg colours", () => {
  const [mako] = CASES;
  const sourceIds = ["Mako-sink-cabinet-aaa111", "Mako-sink-cabinet-bbb222"];

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(mako.profile));
    store.dispatch(setActiveCollectionId(mako.collectionId));
    store.dispatch(setActiveRuntimeBindings(mako.bindings));
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  /** Two Sink Bases saved with the same colours at each, as the Mako scene paints them all at once. */
  const savedWith = (colors: Record<string, string>): ConfigurationRecord => ({
    configuration: Object.fromEntries(
      sourceIds.map((sourceId) => [
        sourceId,
        { ProductType: "Mako-sink-cabinet", Width: 60, Height: 26, Depth: 52, Drawers: "1D" },
      ]),
    ),
    metadata: {
      path: "/prebuilt/model",
      orderedProductIds: sourceIds,
      collectionId: mako.collectionId,
      uiState: {},
      configuration: {
        version: 2,
        collectionId: mako.collectionId,
        cabinets: [
          { stableKey: "cab-1", index: 0 },
          { stableKey: "cab-2", index: 1 },
        ],
        values: { "cabinet:cab-1": colors, "cabinet:cab-2": colors },
      },
    },
  });

  const restore = async (configId: string) => {
    renderAt(mako, `/prebuilt/model?collectionId=${mako.collectionId}&configId=${configId}`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));
  };

  const presetColors = () =>
    getProductsPresets(store.getState()).map(({ HandleColor, LegColor }) => ({ HandleColor, LegColor }));

  // Customize records each cabinet's values again from the presets (CabinetBuilderPage), and the
  // scene configs name the handle and the legs only as scene materials.
  it("hands them to Customize with the presets, cabinet by cabinet", async () => {
    mocks.record = savedWith({ HandleColor: "Gold", LegColor: "Silver" });

    await restore("7201");

    expect(presetColors()).toEqual([
      { HandleColor: "Gold", LegColor: "Silver" },
      { HandleColor: "Gold", LegColor: "Silver" },
    ]);
  });

  it("keeps legs switched off", async () => {
    mocks.record = savedWith({ HandleColor: "Gold", LegColor: "" });

    await restore("7202");

    expect(presetColors()).toEqual([
      { HandleColor: "Gold", LegColor: "" },
      { HandleColor: "Gold", LegColor: "" },
    ]);
  });

  describe("with the composition's handle saved once, at the first cabinet", () => {
    const makoWithCabinets: Case = {
      ...mako,
      cabinets: buildCabinetCatalogFromMatrix(datatable581 as ProductDatatable, mako.profile, mako.bindings),
    };
    const COLORS = { HandleColor: "Antracite 400 MT", LegColor: "Antracite 400 MT" };
    const LEGS_40_2_DRAWER = 'Mako Vanity · 40" 2-Drawer Legs';

    /** A model as Save writes it; the configs name no handle unless a test gives one. */
    const savedModel = (
      configs: Array<Record<string, unknown>>,
      values: Record<string, Record<string, string>>,
    ): ConfigurationRecord => {
      const ids = configs.map(({ ProductType }, index) => `${String(ProductType)}-${"abc"[index].repeat(6)}`);
      return {
        configuration: Object.fromEntries(ids.map((id, index) => [id, configs[index]])),
        metadata: {
          path: "/prebuilt/model",
          orderedProductIds: ids,
          collectionId: mako.collectionId,
          uiState: {},
          configuration: {
            version: 2,
            collectionId: mako.collectionId,
            cabinets: ids.map((_, index) => ({ stableKey: `cab-${index + 1}`, index })),
            values,
          },
        },
      };
    };

    const SINK_BASE = { ProductType: "Mako-sink-cabinet", Width: 60, Height: 52, Depth: 52, Drawers: "2D" };
    const SINK_CABINET = { ProductType: "Mako-side-cabinet", Width: 40, Height: 52, Depth: 52, Drawers: "2D" };

    const restoreWithModels = async (configId: string) => {
      renderAt(
        makoWithCabinets,
        `/prebuilt/model?collectionId=${mako.collectionId}&configId=${configId}`,
        <ModelPage />,
        true,
      );
      await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));
    };

    const handles = () => getProductsPresets(store.getState()).map(({ Handle }) => Handle);

    it("comes back as the model it was saved from, with that model's card highlighted", async () => {
      mocks.record = savedModel([SINK_BASE, SINK_CABINET], {
        "cabinet:cab-1": { ...COLORS, Handle: "G57" },
        "cabinet:cab-2": COLORS,
      });

      await restoreWithModels("7211");

      expect(handles()).toEqual(["G57", "G57"]);
      expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("G57");
      const model8 = makoPresetsDocument.find(({ id }) => id === 8);
      expect(arePrebuiltModelPresetsEqual(model8?.presetProducts, getProductsPresets(store.getState()))).toBe(true);
      expect(screen.getByText(LEGS_40_2_DRAWER).closest('[class*="productModelItem"]')?.className).toMatch(/active/);
    });

    it("leaves a handle the scene gave", async () => {
      mocks.record = savedModel([SINK_BASE, { ...SINK_CABINET, Handle: "G50" }], {
        "cabinet:cab-1": { ...COLORS, Handle: "G57" },
        "cabinet:cab-2": COLORS,
      });

      await restoreWithModels("7212");

      expect(handles()).toEqual(["G57", "G50"]);
    });

    it("leaves cabinets saved with handles that differ per cabinet", async () => {
      mocks.record = savedModel([SINK_BASE, SINK_CABINET, SINK_CABINET], {
        "cabinet:cab-1": { ...COLORS, Handle: "G57" },
        "cabinet:cab-2": { ...COLORS, Handle: "G50" },
        "cabinet:cab-3": COLORS,
      });

      await restoreWithModels("7213");

      expect(handles()).toEqual(["G57", "G50", undefined]);
    });
  });
});

describe("urban-duplex: a Prebuilt order opened from its link keeps each cabinet's series and panel side", () => {
  const parsedUdProfile = parseProductProfile(udProfileDocument);
  const parsedUdBindings = parseRuntimeBindings(udBindingsDocument);
  if (!parsedUdProfile.ok || !parsedUdBindings.ok) throw new Error("the packaged Urban Duplex data must parse");
  const ud: Case = {
    collectionId: "urban-duplex",
    profile: parsedUdProfile.profile,
    bindings: parsedUdBindings.bindings,
    sinkBaseSceneType: "UD-sink-cabinet",
    manifest: udManifestDocument,
    ui: udUiDocument,
    presets: udPresetsDocument,
    countertopTable: datatable595,
  };

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearRestore());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(ud.profile));
    store.dispatch(setActiveCollectionId(ud.collectionId));
    store.dispatch(setActiveRuntimeBindings(ud.bindings));
    mocks.changes.length = 0;
    mocks.sceneReady = true;
  });

  // Model 18: a Duplex Sink Base with its lateral panel on the left, beside an Urban Standard cabinet.
  // The scene configs name neither the series nor the side, and Customize records both from the presets.
  it("hands them to Customize with the presets", async () => {
    const sourceIds = ["UD-sink-cabinet-aaa111", "UD-side-cabinet-bbb222"];
    mocks.record = {
      configuration: {
        [sourceIds[0]]: { ProductType: "UD-sink-cabinet", Width: 70, Height: 53, Depth: 46, Drawers: "1D" },
        [sourceIds[1]]: { ProductType: "UD-side-cabinet", Width: 35, Height: 53, Depth: 46, Drawers: "1D" },
      },
      metadata: {
        path: "/prebuilt/model",
        orderedProductIds: sourceIds,
        collectionId: ud.collectionId,
        uiState: {},
        configuration: {
          version: 2,
          collectionId: ud.collectionId,
          cabinets: [
            { stableKey: "cab-1", index: 0 },
            { stableKey: "cab-2", index: 1 },
          ],
          values: {
            "cabinet:cab-1": { Series: "URDPX", LateralPanelSide: "L", Handle: "UG" },
            "cabinet:cab-2": { Series: "URSTD" },
          },
        },
      },
    };

    renderAt(ud, `/prebuilt/model?collectionId=${ud.collectionId}&configId=7301`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    const presets = getProductsPresets(store.getState()) as Array<Record<string, unknown>>;
    expect(presets.map(({ Series, LateralPanelSide }) => ({ Series, LateralPanelSide }))).toEqual([
      { Series: "URDPX", LateralPanelSide: "L" },
      { Series: "URSTD", LateralPanelSide: undefined },
    ]);
  });

  // The catalog's models leave the handle off an open shelf, whose cabinet table allows none.
  it("gives the composition's handle to the cabinets that take one, not to an open shelf", async () => {
    const sourceIds = ["UD-sink-cabinet-aaa111", "UD-side-cabinet-bbb222", "UD-open-shelves-ccc333"];
    const size = { Height: 53, Depth: 46 };
    mocks.record = {
      configuration: {
        [sourceIds[0]]: { ProductType: "UD-sink-cabinet", Width: 70, Drawers: "1D", ...size },
        [sourceIds[1]]: { ProductType: "UD-side-cabinet", Width: 35, Drawers: "1D", ...size },
        [sourceIds[2]]: { ProductType: "UD-open-shelves", Width: 35, ...size },
      },
      metadata: {
        path: "/prebuilt/model",
        orderedProductIds: sourceIds,
        collectionId: ud.collectionId,
        uiState: {},
        configuration: {
          version: 2,
          collectionId: ud.collectionId,
          cabinets: [
            { stableKey: "cab-1", index: 0 },
            { stableKey: "cab-2", index: 1 },
            { stableKey: "cab-3", index: 2 },
          ],
          values: { "cabinet:cab-1": { Handle: "UG" } },
        },
      },
    };

    const udWithCabinets: Case = {
      ...ud,
      cabinets: buildCabinetCatalogFromMatrix(datatable594 as ProductDatatable, ud.profile, ud.bindings),
    };
    renderAt(udWithCabinets, `/prebuilt/model?collectionId=${ud.collectionId}&configId=7302`, <ModelPage />);
    await waitFor(() => expect(getRestoreState(store.getState()).status).toBe("restored"));

    expect(getProductsPresets(store.getState()).map(({ name, Handle }) => ({ name, Handle }))).toEqual([
      { name: "Sink-Base", Handle: "UG" },
      { name: "Sink-Cabinet", Handle: "UG" },
      { name: "Open-Shelf", Handle: undefined },
    ]);
  });
});

describe("Class model selection", () => {
  const testCase = CASES[1];

  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(testCase.profile));
    store.dispatch(setActiveCollectionId(testCase.collectionId));
    store.dispatch(setActiveRuntimeBindings(testCase.bindings));
    mocks.sceneReady = false;
  });

  it.each([
    ["Iris", true],
    ["VA023", true],
    ["Iris", false],
  ] as const)("selecting another model after %s, resetSelections=%s", async (basin, resetSelections) => {
    if (!resetSelections) {
      store.dispatch(
        setActiveProfile({
          ...testCase.profile,
          ruleData: {
            ...testCase.profile.ruleData,
            prebuiltModelSelection: undefined,
          },
        }),
      );
    }
    const style = basin === "Iris" ? "vessel" : "integrated";
    const composition = createTestCompositionPort();
    const runtime = createTestRuntimePort();
    mocks.ports = { composition: composition.port, runtime: runtime.port };
    recordValues(
      {
        CabinetColor: "Seta 406 MT",
        CabinetSideColor: "Moka 408 MT",
        FrameColor: "Moka 408 MT",
        CountertopColor: "Matte White",
        CountertopStyle: style,
        sinkType: basin,
        Thickness: "0.5",
        VesselColor: "Acqua 419 GL",
        FaucetHolesAmount: "1",
      },
      { getState: store.getState, dispatch: store.dispatch, flow: "prebuilt" },
    );

    // These are deliberate UI choices; a record-only bootstrap is not carry intent.
    for (const attributeId of ["CabinetColor", "CabinetSideColor", "FrameColor", "CountertopColor", "CountertopStyle", "sinkType", "Thickness", "VesselColor", "FaucetHolesAmount"]) {
      store.dispatch(setExplicitUserChoice({ attributeId, chosen: true }));
    }

    renderAt(testCase, "/prebuilt/model?collectionId=class", <ModelPage />, true);
    // Returning to this step alone must keep the user's configuration.
    expect(getCountertopStyle(store.getState())).toBe(style);
    expect(composition.calls).toHaveLength(0);
    fireEvent.click(await screen.findByText('Class Vanity 55" 1-Drawer 1'));

    await waitFor(() => expect(getProductsPresets(store.getState())).toHaveLength(2));
    if (!resetSelections) {
      expect(store.getState().rootStateUI.product.productOptions).toMatchObject({
        CabinetColor: "Seta 406 MT",
        CountertopColor: "Matte White",
        sinkType: "Iris",
      });
      expect(getCountertopStyle(store.getState()).toLowerCase()).toBe("vessel");
      expect(getAttributeValue(store.getState(), "FrameColor", { scope: "global" })).toBe("Moka 408 MT");
      return;
    }
    expect(getCountertopStyle(store.getState()).toLowerCase()).toBe("integrated");
    const options = store.getState().rootStateUI.product.productOptions;
    expect(options).toMatchObject({
      CabinetColor: "INVISIBLE WHITE OPACO 332",
      CountertopColor: "INVISIBLE WHITE OPACO 332",
      Thickness: "0.75",
      sinkType: "LV890",
      VesselColor: "",
      FaucetHolesAmount: "0",
    });
    expect(getAttributeValue(store.getState(), "FrameColor", { scope: "global" })).toBe("Nero 433 MT");
    expect(getAttributeValue(store.getState(), "CabinetSideColor", { scope: "global" })).toBe("Latte 417 MT");
    expect(composition.calls[0]).toMatchObject({
      op: "replace",
      request: {
        products: [
          { config: { Width: 60, CabinetColor: "INVISIBLE WHITE OPACO 332", FrameColor: "Nero 433 MT" } },
          { config: { Width: 80, CabinetColor: "INVISIBLE WHITE OPACO 332", FrameColor: "Nero 433 MT" } },
        ],
      },
    });
    expect(
      getProductsPresets(store.getState()).every(({ CabinetColor }) => CabinetColor === "INVISIBLE WHITE OPACO 332"),
    ).toBe(true);
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

  it("does not replace the configuration or enter Custom when the selected model cannot be placed", async () => {
    // A basin picked on the Countertop & Basin step is the composition's too.
    store.dispatch(setActiveBasinStyle("VA002"));
    store.dispatch(setAttributeValue({ attributeId: "sinkType", target: { scope: "basin" }, value: "VA002" }));

    renderAt(testCase, `/prebuilt/model?collectionId=${testCase.collectionId}`, <ModelPage />, true);
    await act(async () => { fireEvent.click((await screen.findAllByText("Customize"))[0]); });
    expect(getProductsPresets(store.getState())).toHaveLength(0);
    expect(getSinkType(store.getState())).toBe("VA002");
    expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBeNull();
  });
});
