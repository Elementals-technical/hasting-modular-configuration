// @vitest-environment jsdom
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { getHandleGrooveColor, getProductsPresets } from "@/entities/product/model/store/selectors";
import { reset, restoreProductState } from "@/entities/product/model/store/slice";

import { CustomCabinetColorsPage } from "../index";

import type { RootState } from "@/app/store";

const setConfigBatchMock = vi.fn(async (_ids: unknown, _config: unknown) => null);
const saveSnapshotMock = vi.fn(async () => undefined);

vi.mock("@/entities", () => ({
  useGetConfiguratorQuery: () => ({
    isFetching: false,
    data: {
      availableOptions: [
        {
          id: 1,
          proxyName: "Cabinet Color",
          proxyType: "material",
          enabled: true,
          metadata: {},
          options: [
            {
              id: 11,
              name: "HPL",
              resource: null,
              paramString: null,
              playcanvasString: null,
              variants: [
                {
                  id: 101,
                  name: "Old Cabinet Color",
                  image: null,
                  enabled: true,
                  description: "",
                  metadata: {
                    sku: "HPL",
                    value: "Old Cabinet Color",
                    label: "Old Cabinet Color",
                    metadata: { Material: "HPL", Color: "Old", Look: "Matte" },
                  },
                },
                {
                  id: 102,
                  name: "New Cabinet Color",
                  image: null,
                  enabled: true,
                  description: "",
                  metadata: {
                    sku: "HPL",
                    value: "New Cabinet Color",
                    label: "New Cabinet Color",
                    metadata: { Material: "HPL", Color: "New", Look: "Matte" },
                  },
                },
              ],
            },
          ],
        },
        {
          id: 2,
          proxyName: "Handle Groove Color",
          proxyType: "material",
          enabled: true,
          metadata: {},
          options: [
            {
              id: 21,
              name: "HPL",
              resource: null,
              paramString: null,
              playcanvasString: null,
              variants: [
                {
                  id: 201,
                  name: "Old Cabinet Color",
                  image: null,
                  enabled: true,
                  description: "",
                  metadata: { sku: "HPL", value: "Old Cabinet Color", label: "Old Cabinet Color" },
                },
                {
                  id: 202,
                  name: "New Cabinet Color",
                  image: null,
                  enabled: true,
                  description: "",
                  metadata: { sku: "HPL", value: "New Cabinet Color", label: "New Cabinet Color" },
                },
              ],
            },
          ],
        },
      ],
    },
  }),
}));

vi.mock("@/utils/functions/playcanvas/setConfigBatch", () => ({
  setConfigBatch: (ids: unknown, config: unknown) => setConfigBatchMock(ids, config),
}));

vi.mock("@/entities/history/lib/useHistorySnapshot", () => ({
  useHistorySnapshot: () => saveSnapshotMock,
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({
  usePlayCanvasReady: () => true,
}));

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
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

vi.mock("@/shared/ui/Filter/FilterRow", () => ({
  FilterRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/filters/ui/filterItem/FilterItem", () => ({
  FilterItem: () => null,
}));

vi.mock("@/shared/ui/ViewModePanel/ViewModePanel", () => ({
  ViewModePanel: () => null,
}));

vi.mock("@/features/swatchOrder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/swatchOrder")>();

  return {
    ...actual,
    openSwatchOrder: (payload: string) => ({ type: "swatchOrder/openSwatchOrder", payload }),
  };
});

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

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-colors"]}>
        <CustomCabinetColorsPage />
      </MemoryRouter>
    </Provider>,
  );

const restoreImportedPresetState = (args?: { handleGrooveColor?: string }) => {
  const baseOptions = store.getState().rootStateUI.product.productOptions;
  const handleGrooveColor = args?.handleGrooveColor ?? "Old Cabinet Color";

  store.dispatch(
    restoreProductState({
      productIds: ["Sink-Base-runtime"],
      productOptions: {
        ...baseOptions,
        CabinetColor: "Old Cabinet Color",
        HandleGrooveColor: handleGrooveColor,
        Handle: "handle_urban_topcut",
      },
      activeCabinetType: "Sink-Base",
      selectedDimensions: { width: 60, height: 53, depth: 50.5 },
      selectedProductConfig: {
        name: "Sink-Base",
        CabinetColor: "Old Cabinet Color",
        HandleGrooveColor: handleGrooveColor,
        Handle: "handle_urban_topcut",
        Width: 60,
        Height: 53,
        Depth: 50.5,
        Drawers: "1D",
      },
      productsPresets: [
        {
          name: "Sink-Base",
          CabinetColor: "Old Cabinet Color",
          HandleGrooveColor: handleGrooveColor,
          Handle: "handle_urban_topcut",
          Width: 60,
          Height: 53,
          Depth: 50.5,
          Drawers: "1D",
        },
      ],
    }),
  );
};

describe("CustomCabinetColorsPage", () => {
  beforeEach(() => {
    store.dispatch(reset());
    restoreImportedPresetState();
    setConfigBatchMock.mockClear();
    saveSnapshotMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps auto-derived handle groove color in sync when changing cabinet color after preset import", async () => {
    renderPage();
    setConfigBatchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "New Cabinet Color" })[0]);
    });

    expect(setConfigBatchMock).toHaveBeenCalledWith(
      {},
      {
        CabinetColor: "New Cabinet Color",
        HandleGrooveColor: "New Cabinet Color",
      },
    );

    const state = store.getState() as RootState;
    expect(getHandleGrooveColor(state)).toBe("New Cabinet Color");
    expect(getProductsPresets(state)[0]).toMatchObject({
      CabinetColor: "New Cabinet Color",
      HandleGrooveColor: "New Cabinet Color",
    });
  });

  it("does not overwrite an explicitly different handle groove color", async () => {
    cleanup();
    store.dispatch(reset());
    restoreImportedPresetState({ handleGrooveColor: "Explicit Groove Color" });
    setConfigBatchMock.mockClear();

    renderPage();
    setConfigBatchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "New Cabinet Color" })[0]);
    });

    expect(setConfigBatchMock).toHaveBeenCalledWith(
      {},
      {
        CabinetColor: "New Cabinet Color",
      },
    );

    const state = store.getState() as RootState;
    expect(getHandleGrooveColor(state)).toBe("Explicit Groove Color");
    expect(getProductsPresets(state)[0]).toMatchObject({
      CabinetColor: "New Cabinet Color",
      HandleGrooveColor: "Explicit Groove Color",
    });
  });
});
