// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import makoManifestDocument from "../../../../../public/collections/mako/manifest.json";
import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import makoUiDocument from "../../../../../public/collections/mako/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext, presetsSchema } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import {
  PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS,
  resolvePrebuiltModelTransferableOverrides,
} from "@/entities/product/lib/prebuiltModelTransferableFields";
import {
  getActiveCountertopColor,
  getCabinetColor,
  getHandleGrooveColor,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile, setCabinetColor, setHandleGrooveColor } from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Custom → Prebuilt for Mako (bug: the models took the Urban cabinet colour).
 *
 * An empty cabinet builder starts from the active collection's own values. Prebuilt carries the
 * colour chosen in Custom over to the model, so an Urban colour started here would replace the
 * colour of every Mako model.
 */

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const makoCollection = buildReadyCollection("mako", makoManifestDocument, makoUiDocument);
const [makoModel] = presetsSchema.parse(makoPresetsDocument);

const renderEmptyBuilder = async () => {
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

  const state = store.getState();
  return {
    CabinetColor: getCabinetColor(state),
    CountertopColor: getActiveCountertopColor(state),
    sinkType: getSinkType(state),
  };
};

describe("CabinetBuilderPage starting values", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(setActiveCollectionId("mako"));
    store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
  });

  afterEach(cleanup);

  it("starts a Mako builder without the Urban values, so Prebuilt keeps the colour of the Mako model", async () => {
    const started = await renderEmptyBuilder();

    expect(started).toEqual({ CabinetColor: "", CountertopColor: "", sinkType: "" });

    // What Prebuilt then places for a Mako model.
    const overrides = resolvePrebuiltModelTransferableOverrides({
      presetProducts: makoModel.presetProducts,
      selectedOptions: { CabinetColor: started.CabinetColor },
      fields: PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS,
    });
    expect(overrides.CabinetColor).toBe("Antracite Matte OCF");
  });

  it("starts an Urban builder from the Urban values", async () => {
    store.dispatch(setActiveProfile(ushProfile));

    expect(await renderEmptyBuilder()).toEqual({
      CabinetColor: "Pulpis Chiaro TKH",
      CountertopColor: "Cacao Orinoco FF MT",
      sinkType: "Top_Tekorlux_Rectangular",
    });
  });

  it("keeps a colour already chosen", async () => {
    store.dispatch(setCabinetColor("Nebbia 402 MT"));

    expect((await renderEmptyBuilder()).CabinetColor).toBe("Nebbia 402 MT");
  });
});
