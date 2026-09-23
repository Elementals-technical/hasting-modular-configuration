// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset, setActiveProfile, setDividersOption } from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";
import { AccessoriesPage } from "@/pages/accessories/AccessoriesPage";

// The accessories step reads its sections from ui.json and its options from the profile; the pick goes to the command.

const changeMock = vi.fn(async () => ({ status: "applied" as const, plan: [] }));

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();
  return { ...actual, useChangeAttribute: () => ({ change: changeMock, getState: () => store.getState() }) };
});

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));

afterEach(cleanup);

const renderStep = (path = "/prebuilt/accessories", stepId = "accessories") =>
  render(
    <ReadyCollectionContext.Provider value={readyCollectionFixture}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <AccessoriesPage stepId={stepId} />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const sectionTitles = () => screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));

describe("the accessories step from ui.json", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    changeMock.mockClear();
  });

  it("renders the sections ui.json declares, in both flows", () => {
    renderStep();
    expect(sectionTitles()).toEqual(["Side Panels", "Dividers", "Towel Bar"]);
    cleanup();

    renderStep("/custom/accessories", "accessories-custom");
    expect(sectionTitles()).toEqual(["Side Panels", "Dividers", "Towel Bar"]);
  });

  it("lists the towel bar options of the profile and sends a pick through the command", async () => {
    renderStep();

    const towelBar = within(screen.getByRole("region", { name: "Towel Bar" }));
    expect(towelBar.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "None",
      "Left",
      "Right",
      "Both",
    ]);

    await act(async () => {
      fireEvent.click(towelBar.getByRole("button", { name: "Left" }));
    });
    expect(changeMock).toHaveBeenCalledWith({ attributeId: "TowelBarOption", value: "Left", scope: "global" });
  });

  it("shows the divider styles of the profile only while dividers are customised", () => {
    renderStep();
    expect(screen.queryByText("Divider type")).toBeNull();
    cleanup();

    store.dispatch(setDividersOption("Customize"));
    renderStep();
    const dividers = within(screen.getByRole("region", { name: "Dividers" }));
    expect(dividers.getByText("Divider type")).toBeTruthy();
    expect(dividers.getByText("Option A")).toBeTruthy();
  });

  it("offers no groove while no cabinet is in the scene", () => {
    renderStep();

    expect(within(screen.getByRole("region", { name: "Side Panels" })).queryAllByRole("button")).toHaveLength(0);
  });
});
