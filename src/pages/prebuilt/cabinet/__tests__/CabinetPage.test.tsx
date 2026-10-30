// @vitest-environment jsdom
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { configuratorColorGroups } from "@/entities/collection/__tests__/fixtures/configuratorColorGroups";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration } from "@/entities/configuration";
import {
  getCabinetColor,
  getCabinetColorMaterial,
  getCabinetColorSku,
  getHandleGrooveColorSku,
} from "@/entities/product/model/store/selectors";
import {
  addProductPreset,
  reset,
  setActiveProfile,
  setCabinetColor,
  setHandleGrooveColor,
} from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import { CabinetPage } from "../CabinetPage";

const onChangeMock = vi.fn(async (attributeId: string, value: string) => {
  if (attributeId === "CabinetColor") {
    store.dispatch(setCabinetColor(value));
    return { status: "applied" as const, plan: [{ attributeId: "HandleGrooveColor" }] };
  }
  if (attributeId === "HandleGrooveColor") store.dispatch(setHandleGrooveColor(value));
  return { status: "applied" as const, plan: [] };
});

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

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");

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
        <MemoryRouter initialEntries={["/prebuilt/color"]}>
          <CabinetPage />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const loadPreset = (handle: string) =>
  store.dispatch(addProductPreset([{ name: "Sink-Base", Handle: handle, CabinetColor: "Old Cabinet Color" }]));

describe("CabinetPage", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    onChangeMock.mockClear();
  });

  afterEach(cleanup);

  it("renders the step's sections from ui.json and takes the groove capability from the preset's handle", () => {
    loadPreset("handle_pto");
    renderPage();
    expect(sectionTitles()).toEqual(["Cabinet Color", "Drawer Panel Fluting", "Grain Direction"]);

    cleanup();
    loadPreset("handle_urban_topcut");
    renderPage();
    expect(sectionTitles()).toEqual([
      "Cabinet Color",
      "Handle Groove Color (Optional)",
      "Drawer Panel Fluting",
      "Grain Direction",
    ]);
  });

  it("hydrates the colour, its SKU and material from the loaded preset", () => {
    loadPreset("handle_pto");
    renderPage();

    expect(getCabinetColor(store.getState())).toBe("Old Cabinet Color");
    expect(getCabinetColorSku(store.getState())).toBe("HPL");
    expect(getCabinetColorMaterial(store.getState())).toBe("HPL");
  });

  it("changes the cabinet colour through the shared handler and records the SKUs of the applied set", async () => {
    loadPreset("handle_urban_topcut");
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "New Cabinet Color" })[0]);
    });

    expect(onChangeMock).toHaveBeenCalledWith("CabinetColor", "New Cabinet Color");
    expect(getCabinetColorSku(store.getState())).toBe("HPL");
    expect(getHandleGrooveColorSku(store.getState())).toBe("HPL");
  });
});
