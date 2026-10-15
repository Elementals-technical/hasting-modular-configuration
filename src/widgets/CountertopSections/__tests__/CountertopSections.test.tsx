// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { clearHistory, setHistoryRestoring } from "@/entities/history/model/store/slice";
import {
  addProductId,
  reset,
  setActiveCountertopThickness,
  setActiveProfile,
  setCountertopStyle,
} from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { CountertopPage } from "@/pages/countertop/CountertopPage";

// The countertop step reads its sections from ui.json and its options from the profile; the pick goes to the command.

const changeMock = vi.fn(async () => ({ status: "applied" as const, plan: [] }));

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();
  return { ...actual, useChangeAttribute: () => ({ change: changeMock, getState: () => store.getState() }) };
});

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));

afterEach(cleanup);

/** The shipped countertop matrix, so a style the rules allow reads as available. */
const withCountertopRules = {
  ...readyCollectionFixture,
  catalog: {
    ...readyCollectionFixture.catalog,
    countertops: parseCountertopMatrix(datatable438 as unknown as CountertopDatatable),
  },
};

const renderStep = (path = "/prebuilt/countertop", stepId = "countertop", collection = readyCollectionFixture) =>
  render(
    <ReadyCollectionContext.Provider value={collection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <CountertopPage stepId={stepId} />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const sectionTitles = () => screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));

describe("the countertop step from ui.json", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    changeMock.mockClear();
  });

  it("renders the prebuilt sections in the order ui.json declares, without the vessel colour", () => {
    renderStep();

    expect(sectionTitles()).toEqual(["Countertop Color", "Thickness", "Countertop Style", "Basin style"]);
  });

  it("renders the custom flow from the same widget", () => {
    renderStep("/custom/countertop", "countertop-custom");

    expect(sectionTitles()).toEqual(["Countertop Color", "Thickness", "Countertop Style", "Basin style"]);
  });

  it("lists the thicknesses and styles of the profile", () => {
    renderStep();

    const thickness = within(screen.getByRole("region", { name: "Thickness" }));
    expect(thickness.getAllByRole("button").map((button) => button.textContent)).toEqual(
      ushProfile.attributes.find(({ attributeId }) => attributeId === "Thickness")?.options?.map(({ label }) => label),
    );
    const style = within(screen.getByRole("region", { name: "Countertop Style" }));
    expect(style.getByText("Integrated")).toBeTruthy();
    expect(style.getByText("Vessel")).toBeTruthy();
  });

  it("names the basin section as ui.json names it for the chosen style", () => {
    renderStep("/prebuilt/countertop", "countertop", withCountertopRules);
    expect(sectionTitles()).toContain("Basin style");

    act(() => {
      store.dispatch(setCountertopStyle("vessel"));
    });

    expect(sectionTitles()).toContain("Vessel Sink Style");
    expect(sectionTitles()).not.toContain("Basin style");
  });

  it("asks for a thickness before it offers basins", () => {
    renderStep();

    expect(screen.getByText("Select a thickness first to enable basin styles.")).toBeTruthy();
  });

  it("sends a picked thickness through the command", async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(within(screen.getByRole("region", { name: "Thickness" })).getByRole("button", { name: '0.5"' }));
    });

    expect(changeMock).toHaveBeenCalledWith({ attributeId: "Thickness", value: "0.5", scope: "countertop" });
  });
});

describe("the countertop step's resets", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(clearHistory());
    store.dispatch(setHistoryRestoring(false));
    // A placed cabinet, so a history step written here would be one that undo could restore.
    store.dispatch(addProductId("rt-a"));
    store.dispatch(setActiveCountertopThickness("9"));
    changeMock.mockClear();
  });

  const thicknessChanges = () =>
    changeMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as { attributeId?: string }).attributeId === "Thickness",
    );

  it("puts back a thickness the rules allow without writing an undo step", async () => {
    renderStep();
    await act(async () => {});

    expect(thicknessChanges().length).toBeGreaterThan(0);
    expect(store.getState().rootStateUI.history.past).toEqual([]);
  });

  it("waits for an undo to end before it resets anything", async () => {
    store.dispatch(setHistoryRestoring(true));
    renderStep();
    await act(async () => {});

    expect(thicknessChanges()).toEqual([]);

    await act(async () => {
      store.dispatch(setHistoryRestoring(false));
    });

    expect(thicknessChanges().length).toBeGreaterThan(0);
  });
});
