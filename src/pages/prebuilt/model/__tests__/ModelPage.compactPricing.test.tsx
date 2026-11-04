// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import {
  configuratorSchema,
  countertopDatatableSchema,
  parseProductProfile,
  ReadyCollectionContext,
  type CollectionPreset,
} from "@/entities/collection";
import configurator10 from "@/entities/collection/__tests__/fixtures/remote/configurator-10.json";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import {
  getAttributeValue,
  getCabinetEntries,
  getRuntimeSyncState,
  getValuesByAttributeId,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setExplicitUserChoice,
  type ConfigurationRuntimePort,
} from "@/entities/configuration";
import {
  getActiveCountertopThickness,
  getCountertopStyle,
  getSinkType,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import { addProductPreset, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { changeAttribute, recordValues, resolveChangeRequest } from "@/features/configurationCommands";
import type { CabinetsState } from "@/features/configuratorApi";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import type { CompactPresetSource } from "@/features/playCanvasAdapter/lib/applyCompactPreset";
import { CabinetBuilderPage } from "@/pages/custom/cabinetBuilder/CabinetBuilderPage";
import { buildCollectionPricingLines } from "@/shared/lib/pricing";
import {
  collectionPricingInput,
  URBAN_LOW_HEIGHT,
} from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import manifest from "../../../../../public/collections/urban-low-height/manifest.json";
import profileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import bindingsDocument from "../../../../../public/collections/urban-low-height/runtime-bindings.json";
import presetsDocument from "../../../../../public/collections/urban-low-height/presets.json";
import ui from "../../../../../public/collections/urban-low-height/ui.json";
import { ModelPage } from "../ModelPage";

/** The products the scene holds, in its composition order: what Custom finds when it opens. */
const scene = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallbackIds: string[] = []) => (scene.order.length ? scene.order : fallbackIds),
}));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const calls = vi.hoisted(() => ({ imports: vi.fn() }));
/** A stand-in for the scene the page's commands reach, where a test reads what they send it. */
const ports = vi.hoisted(() => ({ runtime: null as ConfigurationRuntimePort | null }));
vi.mock("@/features/configurationCommands/hooks/useChangeAttribute", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands/hooks/useChangeAttribute")>();
  return {
    useChangeAttribute: (options?: Parameters<typeof actual.useChangeAttribute>[0]) =>
      actual.useChangeAttribute({ ...options, ...(ports.runtime ? { runtime: ports.runtime } : {}) }),
  };
});
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/entities/product/ui/ProductModelsGrid/ProductModelsGrid", () => ({
  ProductModelsGrid: ({
    data,
    handleAddPreset,
    handleCustomizePreset,
  }: {
    data: CollectionPreset[];
    handleAddPreset: (products: CollectionPreset["presetProducts"], id: number) => void;
    handleCustomizePreset: (products: CollectionPreset["presetProducts"], id: number) => void;
  }) =>
    data.map((preset) => (
      <div key={preset.id}>
        <button onClick={() => handleAddPreset(preset.presetProducts, preset.id)}>Select {preset.id}</button>
        <button onClick={() => handleCustomizePreset(preset.presetProducts, preset.id)}>Customize {preset.id}</button>
      </div>
    )),
}));
vi.mock("@/features/playCanvasAdapter/lib/applyCompactPreset", async (original) => ({
  ...(await original<typeof import("@/features/playCanvasAdapter/lib/applyCompactPreset")>()),
  applyCompactPresetWithBridge: async (
    preset: CompactPresetSource,
    _create: unknown,
    onImported?: (state: CabinetsState) => Promise<void>,
  ) => {
    calls.imports(preset);
    const cabinets = (preset.rows ?? []).flatMap((row, rowIndex) =>
      row.products.map((product, productIndex) => ({
        id: `${product.name}-${rowIndex}-${productIndex}-${preset.shared?.Width}`,
        definitionId: product.name,
        selection: { ...preset.shared, ...product, Depth: 46 },
        positionM: { x: 0, y: rowIndex * -0.38, z: 0 },
      })),
    );
    // The scene's composition starts from the lower row, unlike its list of cabinets.
    scene.order = [...cabinets].sort((a, b) => a.positionM.y - b.positionM.y).map(({ id }) => id);
    await onImported?.({ cabinets, connections: [], selectedCabinetId: null });
    return { keyToProductId: {} };
  },
}));

const parsed = parseProductProfile(profileDocument);
const bindings = parseRuntimeBindings(bindingsDocument);
if (!parsed.ok || !bindings.ok) throw new Error("Invalid ULH fixture");
const base = buildReadyCollection(
  "urban-low-height",
  manifest,
  ui,
  presetsDocument.filter(({ id }) => id === 28 || id === 29).map((preset) => ({
    ...preset,
    shared: { ...preset.shared, Thickness: undefined },
    top: { ...preset.top, Thickness: undefined },
  })),
);
const collection = { ...base, catalog: { ...base.catalog, runtimeBindings: bindings.bindings, countertops: parseCountertopMatrix(countertopDatatableSchema.parse(datatable589)) } };

const LocationProbe = () => <output data-testid="route">{useLocation().pathname}</output>;

beforeEach(() => {
  sessionStorage.clear();
  scene.order = [];
  ports.runtime = null;
  calls.imports.mockClear();
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(parsed.profile));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(bindings.bindings));
});
afterEach(cleanup);

it("adopts compact primary cabinets for pricing on first URL load and on a subsequent model selection", async () => {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/model?collectionId=urban-low-height&preset=28"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <ModelPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(2));
  expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_urban_topcut");
  expect(getSinkType(store.getState())).toBe("Top_HPL/Fenix_Cover_Gres");
  const imported = calls.imports.mock.calls[0][0] as CompactPresetSource;
  expect(imported.shared?.Thickness).toBe("0.5");
  expect(imported.top?.Thickness).toBe("0.5");
  expect(getActiveCountertopThickness(store.getState())).toBe("0.5");
  expect(getCountertopStyle(store.getState())).toBe("Integrated");
  const before = getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId);
  fireEvent.click(screen.getByRole("button", { name: "Select 29" }));
  await waitFor(() => expect(calls.imports).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).not.toEqual(before),
  );
  expect(getCabinetEntries(store.getState())).toHaveLength(3);
  expect(getCabinetEntries(store.getState()).every(({ runtimeId }) => runtimeId.startsWith("ULH-"))).toBe(true);
});

it("hands Custom the compact model's cabinets, so the builder prices them with their drawers", async () => {
  // The flat model shown before the compact one (ULH's default, one 60 cm Sink Base).
  store.dispatch(
    addProductPreset([
      {
        name: "Sink-Base",
        CabinetColor: "Rox Black TKQ",
        Width: 60,
        Height: 38,
        Depth: 46,
        Drawers: "1D",
        Handle: "handle_urban_topcut",
      },
    ]),
  );
  // A Sink Base above a Side Cabinet and an Open Shelf.
  const model = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/model?collectionId=urban-low-height&preset=28"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <ModelPage /><LocationProbe />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "Customize 29" }));
  await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/custom"));
  expect(getCabinetEntries(store.getState())).toHaveLength(3);
  expect(calls.imports).toHaveBeenCalledTimes(2);
  const adoptedIds = getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId);
  fireEvent.click(screen.getByRole("button", { name: "Customize 29" }));
  await waitFor(() => expect(getActiveCountertopThickness(store.getState())).toBe("0.5"));
  expect(calls.imports).toHaveBeenCalledTimes(2);
  expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).toEqual(adoptedIds);
  model.unmount();

  // "Create Your Own": the builder adopts the cabinets the scene kept.
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(store.getState().rootStateUI.product.hasBootstrappedCabinetBuilder).toBe(true));
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(3));

  const state = store.getState();
  const { lines } = buildCollectionPricingLines(
    collectionPricingInput(
      URBAN_LOW_HEIGHT,
      getCabinetEntries(state).map(({ stableKey, runtimeId }) => ({
        stableKey,
        runtimeId,
        size: { width: 90, height: 38, depth: 46 },
      })),
      { ...getValuesByAttributeId(state) },
      {
        runtimeBindings: bindings.bindings,
        selectedProductConfig: state.rootStateUI.product.selectedProductConfig,
        placedCabinetStyles: state.rootStateUI.product.placedCabinetStyles,
      },
    ),
  );
  expect(lines.filter(({ group }) => group === "cabinet").map(({ sku }) => sku)).toEqual([
    expect.stringMatching(/^VAN-URLH-SC\/1DW\//),
    expect.stringMatching(/^VAN-UROS-/),
    expect.stringMatching(/^VAN-URLH-SB\/1DW\//),
  ]);
});

// A picked vessel takes its colour from the command, so only the vessel is the user's explicit choice.
describe("a compact model selected after a vessel was picked", () => {
  const VESSEL = "Vessel_UrbanModo";
  const COLOR = "Matte White T1C";
  const groups = configuratorSchema.parse(configurator10).availableOptions;
  const withColors = {
    ...collection,
    catalog: {
      ...collection.catalog,
      configurator: {
        groups,
        groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
      },
    },
  };

  /** The configuration with the vessel and its colour; `chosen` names what the user picked. */
  const start = (chosen: string[], style = "vessel", sinkType = VESSEL) => {
    const runtime = createTestRuntimePort();
    ports.runtime = runtime.port;
    recordValues(
      { CountertopColor: "Bianco Male TFA", CountertopStyle: style, sinkType, VesselColor: COLOR },
      { getState: store.getState, dispatch: store.dispatch, flow: "prebuilt" },
    );
    for (const attributeId of chosen) store.dispatch(setExplicitUserChoice({ attributeId, chosen: true }));
    return runtime;
  };

  const placeModel = async () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/model?collectionId=urban-low-height&preset=28"]}>
          <ReadyCollectionContext.Provider value={withColors}>
            <ModelPage />
          </ReadyCollectionContext.Provider>
        </MemoryRouter>
      </Provider>,
    );
    await waitFor(() => expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBe(28));
  };

  const sentColors = (runtime: ReturnType<typeof createTestRuntimePort>) =>
    runtime.calls.flat().flatMap(({ attributeId, value }) => (attributeId === "VesselColor" ? [value] : []));

  it("shows the vessel's colour once the model holds the vessel, and keeps it", async () => {
    const runtime = start(["sinkType"]);
    let sentBeforeImport = -1;
    calls.imports.mockImplementationOnce(() => {
      sentBeforeImport = runtime.calls.length;
    });

    await placeModel();

    expect((calls.imports.mock.calls[0][0] as CompactPresetSource).top?.sinkType).toBe(VESSEL);
    expect(sentBeforeImport).toBe(0);
    expect(sentColors(runtime)).toEqual([COLOR]);
    expect(getVesselColor(store.getState())).toBe(COLOR);
    expect(getAttributeValue(store.getState(), "VesselColor", { scope: "basin" })).toBe(COLOR);
    const sinkBase = getCabinetEntries(store.getState()).find(({ runtimeId }) => runtimeId.startsWith("ULH-sink"));
    expect(
      getAttributeValue(store.getState(), "VesselColor", { scope: "basin", sinkBaseId: sinkBase?.stableKey }),
    ).toBe(COLOR);
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(false);
  });

  it("carries the colour with a vessel only the chosen style brings to the model", async () => {
    const runtime = start(["CountertopStyle"]);

    await placeModel();

    expect((calls.imports.mock.calls[0][0] as CompactPresetSource).top?.sinkType).toBe(VESSEL);
    expect(sentColors(runtime)).toEqual([COLOR]);
  });

  it("sends no colour while the vessel is not the user's choice", async () => {
    const runtime = start([]);

    await placeModel();

    expect(sentColors(runtime)).toEqual([]);
  });

  // The scene's product holds the colour, as a flat model's `shared` gives it, and paints nothing without a vessel.
  it("sends the carried colour to a model whose rules put an integrated basin in place of the vessel", async () => {
    const runtime = start(["sinkType", "CountertopStyle"], "integrated");

    await placeModel();

    expect(getSinkType(store.getState())).not.toBe(VESSEL);
    expect(sentColors(runtime)).toEqual([COLOR]);
    expect(getVesselColor(store.getState())).toBe(COLOR);
  });

  it("finishes the import when the scene does not take the colour", async () => {
    const runtime = start(["sinkType"]);
    runtime.failNext(({ attributeId }) => attributeId === "VesselColor");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await placeModel();

    expect(warn).toHaveBeenCalledWith("[Prebuilt] The vessel colour did not reach the scene", expect.anything());
    expect(getCabinetEntries(store.getState())).toHaveLength(2);
    warn.mockRestore();
  });

  it.each([
    ["fails the colour", "failNext"],
    ["has no translation for the colour", "rejectNext"],
  ] as const)("holds Save when the scene %s, and still places the model", async (_label, refuse) => {
    const runtime = start(["sinkType"]);
    runtime[refuse](({ attributeId }) => attributeId === "VesselColor");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await placeModel();

    expect(sentColors(runtime)).toEqual([COLOR]);
    expect(getRuntimeSyncState(store.getState()).needsSync).toBe(true);
    expect(getCabinetEntries(store.getState())).toHaveLength(2);
    warn.mockRestore();
  });

  // Picking None keeps the colour for the next vessel, but a model placed on the empty cutout holds none.
  const startOnCutout = (chosen = ["sinkType", "CountertopStyle"]) => start(chosen, "vessel", "");

  it("keeps no colour the vessel took with it once a model is placed on the empty cutout", async () => {
    const runtime = startOnCutout();

    await placeModel();

    expect((calls.imports.mock.calls[0][0] as CompactPresetSource).top?.sinkType).toBe("Vessel");
    expect(sentColors(runtime)).toEqual([]);
    expect(getVesselColor(store.getState())).toBe("");
    expect(getAttributeValue(store.getState(), "VesselColor", { scope: "basin" })).toBe("");
  });

  /** A vessel picked through the command, as a field picks it. */
  const pickVessel = async (runtime: ReturnType<typeof createTestRuntimePort>) => {
    const request = resolveChangeRequest(store.getState(), "sinkType", VESSEL);
    if (!request) throw new Error("a placed Sink Base names the basin");
    const picked = await changeAttribute(request, {
      getState: store.getState,
      dispatch: store.dispatch,
      runtime: runtime.port,
      flow: "prebuilt",
      configurator: withColors.catalog.configurator,
    });
    expect(picked.status).toBe("applied");
  };

  it("sends the default colour with a vessel picked on that model", async () => {
    const runtime = startOnCutout();
    await placeModel();

    await pickVessel(runtime);

    // The composition's and the Sink Base's.
    expect(sentColors(runtime)).toEqual([COLOR, COLOR]);
    expect(getVesselColor(store.getState())).toBe(COLOR);
  });

  it("sends and keeps a colour the user chose on the empty cutout, which a vessel picked later shows", async () => {
    // Not the vessel's default, which a pick would send by itself.
    const CHOSEN = "Matte Black T1D";
    const runtime = startOnCutout(["CountertopStyle", "VesselColor"]);
    recordValues({ VesselColor: CHOSEN }, { getState: store.getState, dispatch: store.dispatch, flow: "prebuilt" });

    await placeModel();

    expect(sentColors(runtime)).toEqual([CHOSEN]);
    expect(getVesselColor(store.getState())).toBe(CHOSEN);

    await pickVessel(runtime);

    // The vessel allows it, so the pick sends no colour: the scene's product already holds it from before the vessel.
    const attributeIds = runtime.calls.flat().map(({ attributeId }) => attributeId);
    expect(attributeIds.indexOf("VesselColor")).toBeLessThan(attributeIds.indexOf("sinkType"));
    expect(sentColors(runtime)).toEqual([CHOSEN]);
    expect(getVesselColor(store.getState())).toBe(CHOSEN);
  });
});
