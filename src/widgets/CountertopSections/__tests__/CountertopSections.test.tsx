// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";
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

const renderStep = (path = "/prebuilt/countertop", stepId = "countertop") =>
  render(
    <ReadyCollectionContext.Provider value={readyCollectionFixture}>
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

    expect(sectionTitles()).toEqual([
      "Countertop Color",
      "Thickness",
      "Countertop Style",
      "Basin style / Vessel Sink Style",
    ]);
  });

  it("renders the custom flow from the same widget", () => {
    renderStep("/custom/countertop", "countertop-custom");

    expect(sectionTitles()).toEqual([
      "Countertop Color",
      "Thickness",
      "Countertop Style",
      "Basin style / Vessel Sink Style",
    ]);
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
