// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import makoManifest from "../../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../../public/collections/mako/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import {
  getCabinetEntries,
  getValuesByAttributeId,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { getHandleGrooveColor } from "@/entities/product/model/store/selectors";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setDrawerProduct,
  setHandleGrooveColor,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { buildCollectionPricingLines } from "@/shared/lib/pricing";
import { collectionPricingInput, MAKO } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * A Mako cabinet placed from an empty builder with the plus button, before anything else is
 * chosen, is priced as the cabinet the scene shows: in Mako's starting colour and with the G57
 * handle the scene draws when none is chosen — not as VAN-MAKOV-SB/2DW/X-… without a material.
 */

type PlusClick = (entityId: string, side: "left" | "right") => void | Promise<void>;

const plusButton = vi.hoisted(() => ({ click: null as PlusClick | null }));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/utils/functions/playcanvas/setHandleButtonClick", () => ({
  setHandleButtonClick: (callback: PlusClick) => {
    plusButton.click = callback;
  },
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return { ...adapter, createCompositionPort: () => adapter.createTestCompositionPort([]).port };
});
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const makoCollection = buildReadyCollection("mako", makoManifest, makoUi);
const catalog = buildCabinetCatalogFromMatrix(cabinetTable581 as ProductDatatable, makoProfile);
const product = () => store.getState().rootStateUI.product;

const openEmptyBuilder = async () => {
  // The empty builder resets the product state; a value it does not keep shows that it ran.
  store.dispatch(setHandleGrooveColor("Probe"));

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=mako"]}>
        <ReadyCollectionContext.Provider value={makoCollection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

  await waitFor(() => expect(getHandleGrooveColor(store.getState())).toBe(""));
};

/** A two-drawer 60 cm Sink Base picked on the cards; picking the style opens the sidebar. */
const pickSinkBase = (config: Record<string, unknown> = {}) => {
  store.dispatch(setDrawerProduct("Sink-Base"));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ ...config, Drawers: "2D" }));
  store.dispatch(setSelectedDimensions({ width: 60 }));
  store.dispatch(setOpenStyleSidebar(true));
};

const placeWithPlusButton = async () => {
  await waitFor(() => expect(plusButton.click).not.toBeNull());
  await act(async () => {
    await plusButton.click?.("", "right");
  });
  await waitFor(() => expect(getCabinetEntries(store.getState())).toHaveLength(1));
};

/** Cabinet SKUs of the composition, at the 60 x 52 x 52 cm the scene reports for the Sink Base. */
const cabinetSkus = () => {
  const state = store.getState();
  const input = collectionPricingInput(
    MAKO,
    getCabinetEntries(state).map(({ stableKey, runtimeId }) => ({
      stableKey,
      runtimeId,
      size: { width: 60, height: 52, depth: 52 },
    })),
    { ...getValuesByAttributeId(state) },
    {
      runtimeBindings: makoRuntimeBindings,
      selectedProductConfig: product().selectedProductConfig,
      placedCabinetStyles: product().placedCabinetStyles,
    },
  );

  return buildCollectionPricingLines(input)
    .lines.filter(({ group }) => group === "cabinet")
    .map(({ sku }) => sku);
};

describe("a Mako cabinet placed from an empty builder", () => {
  beforeEach(() => {
    plusButton.click = null;
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(setActiveCollectionId("mako"));
    store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
    store.dispatch(setCabinetCatalog(catalog));
  });

  afterEach(cleanup);

  it("is priced in Mako's starting colour with the G57 the scene draws when nothing is chosen", async () => {
    await openEmptyBuilder();
    pickSinkBase();

    await placeWithPlusButton();

    expect(cabinetSkus()).toEqual(["VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-CAB-LACM-400"]);
  });

  it("keeps the handle the user chose", async () => {
    await openEmptyBuilder();
    pickSinkBase({ Handle: "G50" });

    await placeWithPlusButton();

    expect(cabinetSkus()).toEqual(["VAN-MAKOV-SB/2DW/G50-23.6W-20.5H-20.5D-CAB-LACM-400"]);
  });
});
