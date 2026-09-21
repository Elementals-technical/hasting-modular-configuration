// @vitest-environment jsdom
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { configuratorColorGroups } from "@/entities/collection/__tests__/fixtures/configuratorColorGroups";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, syncCabinets } from "@/entities/configuration";
import {
  getBookMatching,
  getCabinetColor,
  getCabinetColorSku,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
} from "@/entities/product/model/store/selectors";
import {
  reset,
  restoreProductState,
  setActiveProfile,
  setBookMatching,
  setCabinetColor,
  setCabinetColorMaterial,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
} from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import { CustomCabinetColorsPage } from "../index";

const onChangeMock = vi.fn(async (attributeId: string, value: string) => {
  if (attributeId === "CabinetColor") store.dispatch(setCabinetColor(value));
  if (attributeId === "HandleGrooveColor") store.dispatch(setHandleGrooveColor(value));
  if (attributeId === "DrawerPanelFluting") store.dispatch(setDrawerPanelFluting(value));
  if (attributeId === "GrainDirection") store.dispatch(setGrainDirection(value));
  if (attributeId === "BookMatching") store.dispatch(setBookMatching(value));
  return { status: "applied" as const, plan: [] };
});

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: async () => null,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({
  usePlayCanvasReady: () => true,
}));

vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({
  useCompactAccordionViewport: () => false,
}));

vi.mock("@/shared/ui/Accordion/useSyncedAccordionValue", () => ({
  useSyncedAccordionValue: ({ defaultValue }: { defaultValue?: string }) => ({
    value: defaultValue,
    onValueChange: vi.fn(),
  }),
}));

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();

  return {
    ...actual,
    useAttributeChangeHandler: (attributeId: string) => ({
      onChange: (value: string) => onChangeMock(attributeId, value),
      preview: null,
      notice: null,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }),
  };
});

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/shared/ui/Filter/FilterRow", () => ({
  FilterRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/filters/ui/filterItem/FilterItem", () => ({
  FilterItem: () => null,
}));

vi.mock("@/shared/ui/ViewModePanel/ViewModePanel", () => ({
  ViewModePanel: () => null,
}));

vi.mock("@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid", () => ({
  ProductOptionsGrid: ({
    data,
    handleAdd,
  }: {
    data: Array<{ title: string; metadata?: { value?: string } }>;
    handleAdd: (value: string) => void;
  }) => (
    <div>
      {data.map((item) => {
        const value = item.metadata?.value ?? item.title;
        return (
          <button key={value} type="button" onClick={() => handleAdd(value)}>
            {value}
          </button>
        );
      })}
    </div>
  ),
}));

const readyCollection = {
  ...readyCollectionFixture,
  catalog: { ...readyCollectionFixture.catalog, configurator: configuratorColorGroups },
};

const sectionTitles = () => screen.queryAllByRole("region").map((region) => region.getAttribute("aria-label"));

const renderPage = () =>
  render(
    <ReadyCollectionContext.Provider value={readyCollection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/custom/cabinet-colors"]}>
          <CustomCabinetColorsPage />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const restoreImportedPresetState = (handle = "handle_urban_topcut") => {
  const baseOptions = store.getState().rootStateUI.product.productOptions;

  store.dispatch(
    restoreProductState({
      productIds: ["Sink-Base-runtime"],
      productOptions: {
        ...baseOptions,
        CabinetColor: "Old Cabinet Color",
        HandleGrooveColor: "Old Cabinet Color",
        Handle: handle,
      },
      activeCabinetType: "Sink-Base",
      selectedDimensions: { width: 60, height: 53, depth: 50.5 },
      selectedProductConfig: {
        name: "Sink-Base",
        CabinetColor: "Old Cabinet Color",
        HandleGrooveColor: "Old Cabinet Color",
        Handle: handle,
        Width: 60,
        Height: 53,
        Depth: 50.5,
        Drawers: "1D",
      },
      productsPresets: [],
    }),
  );
  store.dispatch(syncCabinets(["Sink-Base-runtime"]));
};

describe("CustomCabinetColorsPage", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    restoreImportedPresetState();
    onChangeMock.mockClear();
  });

  afterEach(cleanup);

  it("renders the step's sections in ui.json order, with the groove section only for a groove-capable handle", () => {
    renderPage();
    expect(sectionTitles()).toEqual([
      "Cabinet Color",
      "Handle Groove Color (Optional)",
      "Drawer Panel Fluting",
      "Grain Direction",
    ]);

    cleanup();
    restoreImportedPresetState("handle_pto");
    renderPage();
    expect(sectionTitles()).toEqual(["Cabinet Color", "Drawer Panel Fluting", "Grain Direction"]);
  });

  it("offers the configurator colours of the profile's optionsSource, with None first for the groove", () => {
    renderPage();

    const buttonsIn = (name: string) =>
      [...screen.getByRole("region", { name }).querySelectorAll("button")].map((button) => button.textContent);

    expect(buttonsIn("Cabinet Color")).toEqual(["New Cabinet Color", "Old Cabinet Color"]);
    expect(buttonsIn("Handle Groove Color (Optional)")).toEqual(["New Cabinet Color", "None", "Old Cabinet Color"]);
  });

  it("changes the cabinet colour through the shared handler and records the colour's SKU", async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "New Cabinet Color" })[0]);
    });

    expect(onChangeMock).toHaveBeenCalledWith("CabinetColor", "New Cabinet Color");
    expect(getCabinetColor(store.getState())).toBe("New Cabinet Color");
    expect(getCabinetColorSku(store.getState())).toBe("HPL");
  });

  it("changes the groove colour through the shared handler", async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "None" }));
    });

    expect(onChangeMock).toHaveBeenCalledWith("HandleGrooveColor", "None");
    expect(getHandleGrooveColor(store.getState())).toBe("None");
  });

  it("changes the drawer panel fluting through the shared handler", async () => {
    store.dispatch(setCabinetColorMaterial("LACM"));
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "FlutingVerticalA" }));
    });

    expect(onChangeMock).toHaveBeenCalledWith("DrawerPanelFluting", "FlutingVerticalA");
    expect(getDrawerPanelFluting(store.getState())).toBe("FlutingVerticalA");
  });

  it("changes the grain direction through the shared handler", async () => {
    store.dispatch(setCabinetColorMaterial("Essenze"));
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "GrainVertical" }));
    });

    expect(onChangeMock).toHaveBeenCalledWith("GrainDirection", "GrainVertical");
    expect(getGrainDirection(store.getState())).toBe("GrainVertical");
  });

  it("toggles book matching from the schema-resolved field, alongside grain direction in the same section", async () => {
    store.dispatch(setCabinetColorMaterial("Essenze"));
    // the checkbox is enabled only for 2 adjacent drawer cabinets with a grain direction
    store.dispatch(
      restoreProductState({
        productIds: ["Sink-Base-1-runtime", "Sink-Base-2-runtime"],
        productOptions: store.getState().rootStateUI.product.productOptions,
        activeCabinetType: "Sink-Base",
        selectedDimensions: { width: 60, height: 53, depth: 50.5 },
        selectedProductConfig: null,
        productsPresets: [],
      }),
    );
    store.dispatch(setGrainDirection("GrainHorizontal"));

    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });

    expect(onChangeMock).toHaveBeenCalledWith("BookMatching", "enabled");
    expect(getBookMatching(store.getState())).toBe("enabled");
  });
});
