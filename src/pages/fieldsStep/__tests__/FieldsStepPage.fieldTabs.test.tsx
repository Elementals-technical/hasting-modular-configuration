// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import { getCabinetEntries, resetConfiguration, setAttributeValue, syncCabinets } from "@/entities/configuration";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import manifest from "../../../../public/collections/urban-duplex/manifest.json";
import profileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import ui from "../../../../public/collections/urban-duplex/ui.json";
import { FieldsStepPage } from "../FieldsStepPage";

/**
 * An Urban Duplex front is two panels, each in a colour of its own. The Color step shows them in
 * one section: the user picks the panel on a tab, then its colour in the grid under the tabs.
 * The section is the collection's ui.json (`fieldTabs`, each field's `tab`), not page code.
 */

const mocks = vi.hoisted(() => ({ change: vi.fn() }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));
vi.mock("@/features/configurationCommands", async (original) => ({
  ...(await original<typeof import("@/features/configurationCommands")>()),
  useAttributeChangeHandler: (attributeId: string) => ({
    onChange: (value: string) => mocks.change(attributeId, value),
    notice: null,
  }),
}));

const parsed = parseProductProfile(profileDocument);
if (!parsed.ok) throw new Error("Urban Duplex profile must parse");

// The collection's own material configurator (13): Select Cabinet Colors with an option per panel.
const groups = configurator13.availableOptions as unknown as ConfiguratorAvailableOption[];
const configurator = { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) };

const BASE_COLOR = "Bianco Calce DA ST";
const LATERAL_COLOR = "Pulpis Chiaro TKH";
const ICONS = "https://app.test/collections/urban-duplex/images/panel";

const renderColorStep = (uiDocument: unknown = ui) => {
  const collection = buildReadyCollection("urban-duplex", manifest, uiDocument);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/color?collectionId=urban-duplex"]}>
        <ReadyCollectionContext.Provider value={{ ...collection, catalog: { ...collection.catalog, configurator } }}>
          <FieldsStepPage stepId="cabinet" />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

const panelColors = () => screen.getByRole("region", { name: "Panel Color" });
const tab = (name: string) => within(panelColors()).getByRole("tab", { name });
/** Every panel the section has drawn, the one of another tab included. */
const drawnPanels = () => within(panelColors()).queryAllByRole("tabpanel", { hidden: true });
/** A colour of the grid under the chosen tab. */
const swatch = (name: string) => within(within(panelColors()).getByRole("tabpanel")).getByRole("button", { name });
const isChosen = (name: string) => swatch(name).getAttribute("aria-pressed") === "true";

beforeEach(() => {
  mocks.change.mockReset().mockResolvedValue({ status: "applied", plan: [] });
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(parsed.profile));

  // A placed cabinet with a colour on each panel, recorded where a field records it.
  store.dispatch(syncCabinets(["UD-sink-cabinet-test1"]));
  const [{ stableKey }] = getCabinetEntries(store.getState());
  const target = { scope: "cabinet", cabinetId: stableKey } as const;
  store.dispatch(setAttributeValue({ attributeId: "BasePanelColor", target, value: BASE_COLOR }));
  store.dispatch(setAttributeValue({ attributeId: "LateralPanelColor", target, value: LATERAL_COLOR }));
});

afterEach(cleanup);

describe("the Urban Duplex Panel Color section", () => {
  it("is one section with a tab per panel, each with its picture, under the line that says what to do", () => {
    renderColorStep();

    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Panel Color",
      "Lateral Panel",
    ]);

    const section = within(panelColors());
    expect(section.getByText("Select Panel, Then Color")).toBeTruthy();
    expect(section.getByRole("tablist").getAttribute("aria-label")).toBe("Select Panel, Then Color");
    expect(section.getAllByRole("tab").map((node) => node.textContent)).toEqual(["Base Panel", "Lateral Panel"]);
    expect(section.getAllByRole("tab").map((node) => node.querySelector("img")?.getAttribute("src"))).toEqual([
      `${ICONS}/base-panel.svg`,
      `${ICONS}/lateral-panel.svg`,
    ]);
  });

  it("opens on the Base Panel with its colour chosen, and draws no other grid yet", () => {
    renderColorStep();

    expect(tab("Base Panel").getAttribute("aria-selected")).toBe("true");
    expect(drawnPanels()).toHaveLength(1);
    expect(isChosen(BASE_COLOR)).toBe(true);
    expect(isChosen(LATERAL_COLOR)).toBe(false);
  });

  it("shows the Lateral Panel colour on its tab and keeps the grid it left", () => {
    renderColorStep();

    fireEvent.click(tab("Lateral Panel"));

    expect(tab("Lateral Panel").getAttribute("aria-selected")).toBe("true");
    expect(isChosen(LATERAL_COLOR)).toBe(true);
    expect(isChosen(BASE_COLOR)).toBe(false);
    // The Base Panel grid stays in the page, hidden, with the filters the user set in it.
    expect(drawnPanels()).toHaveLength(2);
  });

  it("gives a colour to the panel whose tab is chosen", async () => {
    renderColorStep();

    await act(async () => {
      fireEvent.click(swatch(LATERAL_COLOR));
    });
    expect(mocks.change).toHaveBeenLastCalledWith("BasePanelColor", LATERAL_COLOR);

    fireEvent.click(tab("Lateral Panel"));
    await act(async () => {
      fireEvent.click(swatch(BASE_COLOR));
    });
    expect(mocks.change).toHaveBeenLastCalledWith("LateralPanelColor", BASE_COLOR);
    expect(mocks.change).toHaveBeenCalledTimes(2);
  });

  it("shows a section left with one field without tabs, as any other section", () => {
    const section = ui.sections["panel-color"];
    renderColorStep({
      ...ui,
      sections: { ...ui.sections, "panel-color": { ...section, fields: [section.fields[0]] } },
    });

    expect(within(panelColors()).queryByRole("tablist")).toBeNull();
    expect(within(panelColors()).queryByText("Select Panel, Then Color")).toBeNull();
    expect(within(panelColors()).getByRole("button", { name: BASE_COLOR }).getAttribute("aria-pressed")).toBe("true");
  });
});
