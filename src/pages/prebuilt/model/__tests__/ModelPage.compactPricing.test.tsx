// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext, type CollectionPreset } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import {
  getCabinetEntries,
  getValuesByAttributeId,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import { getCountertopStyle, getSinkType } from "@/entities/product/model/store/selectors";
import { addProductPreset, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import type { CabinetsState } from "@/features/configuratorApi";
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
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/entities/product/ui/ProductModelsGrid/ProductModelsGrid", () => ({
  ProductModelsGrid: ({
    data,
    handleAddPreset,
  }: {
    data: CollectionPreset[];
    handleAddPreset: (products: CollectionPreset["presetProducts"], id: number) => void;
  }) =>
    data.map((preset) => (
      <button key={preset.id} onClick={() => handleAddPreset(preset.presetProducts, preset.id)}>
        Select {preset.id}
      </button>
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
  presetsDocument.filter(({ id }) => id === 28 || id === 29),
);
const collection = { ...base, catalog: { ...base.catalog, runtimeBindings: bindings.bindings } };

beforeEach(() => {
  sessionStorage.clear();
  scene.order = [];
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
      <MemoryRouter initialEntries={["/prebuilt/model?collectionId=urban-low-height&preset=29"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <ModelPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(3));
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
