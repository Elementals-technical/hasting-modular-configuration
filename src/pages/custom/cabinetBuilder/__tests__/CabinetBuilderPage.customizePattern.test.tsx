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
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import { addProductPreset, reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Prebuilt → Custom for Tricot: the scene keeps the model's modules, and Custom records them again
 * from the presets. The pattern chosen in Prebuilt is the presets' too; the cabinets must hold it,
 * as the price reads it there (VAN-TRIC-SB/1DW/TWLL-…, not the collection's Satin).
 */

const SCENE_IDS = ["Tricot-sink-cabinet-aaa111", "Tricot-side-cabinet-bbb222"];

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: () => ["Tricot-sink-cabinet-aaa111", "Tricot-side-cabinet-bbb222"],
}));
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

describe("Customize a Tricot model", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(parsedProfile.profile));
    store.dispatch(setActiveCollectionId("tricot"));
    store.dispatch(setActiveRuntimeBindings(parsedBindings.bindings));
  });

  afterEach(cleanup);

  it("keeps the pattern chosen in Prebuilt on the cabinets the scene kept", async () => {
    // The presets as Prebuilt leaves them once Twill was chosen for the model.
    store.dispatch(
      addProductPreset([
        { name: "Sink-Base", Width: 60, Drawers: "1D", DrawerPanelFluting: "Twill" },
        { name: "Side-Cabinet", Width: 40, Drawers: "1D", DrawerPanelFluting: "Twill" },
      ]),
    );

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=tricot"]}>
          <ReadyCollectionContext.Provider value={tricotCollection}>
            <CabinetBuilderPage />
          </ReadyCollectionContext.Provider>
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() =>
      expect(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId)).toEqual(SCENE_IDS),
    );
    const [first] = getCabinetEntries(store.getState());
    await waitFor(() =>
      expect(
        getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: first.stableKey }),
      ).toBe("Twill"),
    );
  });
});
