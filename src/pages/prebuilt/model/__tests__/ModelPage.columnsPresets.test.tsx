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
import { getSinkType } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import type {
  CabinetsState,
  ConfiguratorCompactColumn,
  ConfiguratorCompactPreset,
  ConfiguratorImportReceipt,
  ConfiguratorPresetProduct,
} from "@/features/configuratorApi";
import type {
  CompactPresetDocumentBuilder,
  CompactPresetSource,
} from "@/features/playCanvasAdapter/lib/applyCompactPreset";
import { buildCollectionPricingLines } from "@/shared/lib/pricing";
import {
  collectionPricingInput,
  URBAN_DUPLEX,
} from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import manifest from "../../../../../public/collections/urban-duplex/manifest.json";
import profileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import bindingsDocument from "../../../../../public/collections/urban-duplex/runtime-bindings.json";
import presetsDocument from "../../../../../public/collections/urban-duplex/presets.json";
import ui from "../../../../../public/collections/urban-duplex/ui.json";
import { ModelPage } from "../ModelPage";

/** The products the scene holds, in its composition order: a column's top before its bottom. */
const scene = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallbackIds: string[] = []) => (scene.order.length ? scene.order : fallbackIds),
}));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const calls = vi.hoisted(() => ({ documents: [] as ConfiguratorCompactPreset[] }));
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
// The scene imports the document: a column's top hangs at the tier, its bottom stands on the floor,
// and each cabinet gets the key of its place in the document.
vi.mock("@/features/playCanvasAdapter/lib/applyCompactPreset", async (original) => {
  const actual = await original<typeof import("@/features/playCanvasAdapter/lib/applyCompactPreset")>();
  return {
    ...actual,
    applyCompactPresetWithBridge: async (
      preset: CompactPresetSource,
      _create: unknown,
      onImported?: (state: CabinetsState, receipt: ConfiguratorImportReceipt) => Promise<void>,
      toDocument: CompactPresetDocumentBuilder = actual.toCompactPreset,
    ) => {
      const document = toDocument(preset);
      calls.documents.push(document);
      const slots = document.rows[0].products.flatMap((item): [ConfiguratorPresetProduct, number][] => {
        if ("name" in item) return [[item as ConfiguratorPresetProduct, 0]];
        const { top, bottom } = item as ConfiguratorCompactColumn;
        return [
          ...(top ? [[top, 0.28] as [ConfiguratorPresetProduct, number]] : []),
          ...(bottom ? [[bottom, 0] as [ConfiguratorPresetProduct, number]] : []),
        ];
      });
      const cabinets = slots.map(([item, y], index) => ({
        id: `${item.name}-${index}-${calls.documents.length}`,
        definitionId: item.name,
        selection: {
          ...document.shared,
          ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== "name" && key !== "offsetX")),
        },
        positionM: { x: index, y, z: 0 },
      }));
      scene.order = cabinets.map(({ id }) => id);
      const receipt = {
        keyToProductId: Object.fromEntries(cabinets.map(({ id }, index) => [`cabinet${index}`, id])),
      } as ConfiguratorImportReceipt;
      await onImported?.({ cabinets, connections: [], selectedCabinetId: null }, receipt);
      return receipt;
    },
  };
});

const parsed = parseProductProfile(profileDocument);
const bindings = parseRuntimeBindings(bindingsDocument);
if (!parsed.ok || !bindings.ok) throw new Error("Invalid Urban Duplex fixture");
const base = buildReadyCollection(
  "urban-duplex",
  manifest,
  ui,
  presetsDocument.filter(({ id }) => id === 29 || id === 45),
);
const collection = { ...base, catalog: { ...base.catalog, runtimeBindings: bindings.bindings } };

beforeEach(() => {
  sessionStorage.clear();
  scene.order = [];
  calls.documents = [];
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(parsed.profile));
  store.dispatch(setActiveCollectionId("urban-duplex"));
  store.dispatch(setActiveRuntimeBindings(bindings.bindings));
});
afterEach(cleanup);

const ownValues = (attributeId: string) => {
  const state = store.getState();
  const values = getValuesByAttributeId(state)[attributeId] ?? [];
  return getCabinetEntries(state).map(
    ({ stableKey }) =>
      values.find(({ target }) => target.scope === "cabinet" && target.cabinetId === stableKey)?.value ?? null,
  );
};
const globalValue = (attributeId: string) =>
  getValuesByAttributeId(store.getState())[attributeId]?.find(({ target }) => target.scope === "global")?.value ?? null;

const renderModel = (presetId: number) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/prebuilt/model?collectionId=urban-duplex&preset=${presetId}`]}>
        <ReadyCollectionContext.Provider value={collection}>
          <ModelPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

it("imports a Multi-Level model of Urban Duplex as a column and records each cabinet as the preset has it", async () => {
  renderModel(29);
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(2));

  // The scene's own format: the Side Cabinet stands under the hanging Sink Base, 55 cm to the right.
  expect(calls.documents[0]).toMatchObject({
    format: "urban-compact-v2",
    collection: "UD",
    rows: [
      {
        products: [
          {
            top: expect.objectContaining({ name: "UD-sink-cabinet", HandleSide: "Left" }),
            bottom: expect.objectContaining({ name: "UD-side-cabinet", HandleSide: "Right", offsetX: 55 }),
          },
        ],
      },
    ],
  });
  // What the scene's configs cannot tell back: the series and the side of each lateral panel.
  expect(ownValues("Series")).toEqual(["URDPX", "URDPX"]);
  expect(ownValues("LateralPanelSide")).toEqual(["L", "R"]);
  expect(globalValue("BasePanelColor")).toBe("Bianco Calce DA ST");
  expect(globalValue("LateralPanelColor")).toBe("Pulpis Chiaro TKH");
  expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
  expect(store.getState().rootStateUI.product.productsPresets).toEqual([
    expect.objectContaining({ name: "Sink-Base", Series: "URDPX", Width: 70, LateralPanelSide: "L" }),
    expect.objectContaining({ name: "Sink-Cabinet", Series: "URDPX", Width: 90, LateralPanelSide: "R" }),
  ]);

  const state = store.getState();
  const { lines } = buildCollectionPricingLines(
    collectionPricingInput(
      URBAN_DUPLEX,
      getCabinetEntries(state).map(({ stableKey, runtimeId }, index) => ({
        stableKey,
        runtimeId,
        size: { width: index === 0 ? 70 : 90, height: 28, depth: 50 },
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
    expect.stringMatching(/^VAN-URDPX-SB\/1DWL\//),
    expect.stringMatching(/^VAN-URDPX-SC\/1DWR\//),
  ]);
});

it("replaces the model's cabinets when another Multi-Level model is chosen", async () => {
  renderModel(29);
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(2));
  const before = getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId);

  fireEvent.click(screen.getByRole("button", { name: "Select 45" }));
  await waitFor(() => expect(calls.documents).toHaveLength(2));
  await waitFor(() =>
    expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).not.toEqual(before),
  );

  expect(calls.documents[1].rows[0].products).toEqual([
    {
      top: expect.objectContaining({ name: "UD-sink-cabinet", Width: 90 }),
      bottom: expect.objectContaining({ name: "UD-side-cabinet", Width: 105, offsetX: 75 }),
    },
  ]);
  expect(ownValues("LateralPanelSide")).toEqual(["L", "R"]);
  expect(store.getState().rootStateUI.product.productsPresets.map(({ Width }) => Width)).toEqual([90, 105]);
});
