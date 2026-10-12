// @vitest-environment jsdom
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
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import { getCountertopStyle, getSinkType } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import type { CabinetsState } from "@/features/configuratorApi";
import type { CompactPresetSource } from "@/features/playCanvasAdapter/lib/applyCompactPreset";

import manifest from "../../../../../public/collections/urban-low-height/manifest.json";
import profileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import bindingsDocument from "../../../../../public/collections/urban-low-height/runtime-bindings.json";
import presetsDocument from "../../../../../public/collections/urban-low-height/presets.json";
import ui from "../../../../../public/collections/urban-low-height/ui.json";
import { ModelPage } from "../ModelPage";

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
