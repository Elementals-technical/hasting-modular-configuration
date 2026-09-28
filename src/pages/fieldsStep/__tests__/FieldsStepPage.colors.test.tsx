// @vitest-environment jsdom

import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import makoManifestDocument from "../../../../public/collections/mako/manifest.json";
import makoUiDocument from "../../../../public/collections/mako/ui.json";
import ulhManifestDocument from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUiDocument from "../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import colorFieldStyles from "@/features/collectionCustomization/ui/ColorField.module.scss";
import { getCabinetEntries, resetConfiguration, setAttributeValue, syncCabinets } from "@/entities/configuration";
import {
  reset,
  setActiveProfile,
  setPlacedCabinetStyle,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import { FieldsStepPage } from "../FieldsStepPage";

/**
 * Colour fields of a collection without its own colour screen (Urban Low Height, Class, Mako) are
 * shown by the generic fields step. They must show the material pictures the configurator gives,
 * as the Urban Standard colour screens do, not text chips.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const parsedProfile = parseProductProfile(ulhProfileDocument);
if (!parsedProfile.ok) throw new Error("Urban Low Height profile must parse");

const cabinetColors: ConfiguratorAvailableOption = {
  id: 15,
  proxyName: "Cabinet Color",
  proxyType: "material",
  enabled: true,
  metadata: {},
  options: [
    {
      id: 150,
      name: "Lacquered Matte",
      resource: null,
      paramString: null,
      playcanvasString: null,
      variants: [
        {
          id: 1500,
          name: "Pulpis Chiaro TKH",
          image: null,
          enabled: true,
          description: "",
          metadata: { sku: "TKH", value: "Pulpis Chiaro TKH", image: "/api/files/hash/sha256-pulpis" },
        },
      ],
    },
  ],
};

const grooveColors: ConfiguratorAvailableOption = { ...cabinetColors, id: 16, proxyName: "Handle Groove Color" };

const renderColorStep = () => {
  const collection = buildReadyCollection("urban-low-height", ulhManifestDocument, ulhUiDocument);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/color?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider
          value={{
            ...collection,
            catalog: {
              ...collection.catalog,
              configurator: {
                groups: [cabinetColors, grooveColors],
                groupsByName: { "Cabinet Color": cabinetColors, "Handle Groove Color": grooveColors },
              },
            },
          }}
        >
          <FieldsStepPage stepId="color" />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

describe("FieldsStepPage colour fields", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(parsedProfile.profile));
  });

  /** Records a cabinet value where a field records it: at the first placed cabinet. */
  const recordAtFirstCabinet = (attributeId: string, value: string) => {
    store.dispatch(syncCabinets(["Sink-Base-1", "Sink-Base-2"]));
    const [first] = getCabinetEntries(store.getState());
    store.dispatch(setAttributeValue({ attributeId, target: { scope: "cabinet", cabinetId: first.stableKey }, value }));
  };

  const isChosen = (option: HTMLElement) => option.closest('[class*="activeItem"]') !== null;

  afterEach(cleanup);

  it("shows the configurator picture of each colour, as the Urban Standard colour screens do", () => {
    renderColorStep();

    const section = screen.getByRole("region", { name: "Cabinet Color" });
    const pictures = within(section)
      .getAllByRole("img")
      .map((image) => image.getAttribute("src"));

    expect(pictures).toContain("https://preview.threekit.com/api/files/hash/sha256-pulpis");
  });

  const renderMakoColorStep = () => {
    store.dispatch(setActiveProfile(makoProfile));
    const collection = buildReadyCollection("mako", makoManifestDocument, makoUiDocument);
    const makoGroups = configurator9.availableOptions as unknown as ConfiguratorAvailableOption[];

    return render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/color?collectionId=mako"]}>
          <ReadyCollectionContext.Provider
            value={{
              ...collection,
              catalog: {
                ...collection.catalog,
                configurator: {
                  groups: makoGroups,
                  groupsByName: Object.fromEntries(makoGroups.map((group) => [group.proxyName, group])),
                },
              },
            }}
          >
            <FieldsStepPage stepId="color" />
          </ReadyCollectionContext.Provider>
        </MemoryRouter>
      </Provider>,
    );
  };

  // Mako's section holds every colour in one option named after the attribute, so the grid can
  // only group them by the material each variant names.
  it("groups a Mako colour by the material its own configurator names", () => {
    renderMakoColorStep();

    const section = within(screen.getByRole("region", { name: "Cabinet Color" }));
    expect(section.getByText("Lacquered MT")).toBeTruthy();
    expect(section.getByText("Lacquered GL")).toBeTruthy();
    expect(section.queryByText("Other")).toBeNull();
    expect(section.getAllByText("Nebbia 402 MT").length).toBeGreaterThan(0);
  });

  it("shows the Mako handle colour the composition holds as chosen", () => {
    recordAtFirstCabinet("HandleColor", "Gold");
    renderMakoColorStep();

    const section = within(screen.getByRole("region", { name: "Handle Color" }));
    expect(section.getAllByText("Gold").some(isChosen)).toBe(true);
    expect(section.getAllByText("Silver").some(isChosen)).toBe(false);
  });

  describe("Mako legs", () => {
    const legColorSection = () => within(screen.getByRole("region", { name: "Leg Color" }));
    const isPressed = (name: "On" | "Off") =>
      legColorSection().getByRole("button", { name }).getAttribute("aria-pressed") === "true";

    it("are switched off without a leg colour, which offers the colours", () => {
      renderMakoColorStep();

      expect(legColorSection().getByText("Enable Legs, Then Color")).toBeTruthy();
      expect(isPressed("Off")).toBe(true);
      expect(isPressed("On")).toBe(false);
      expect(legColorSection().queryByText("None")).toBeNull();
      expect(legColorSection().getAllByText("Gold").length).toBeGreaterThan(0);
    });

    it("are switched on in the cabinet colour, with no leg colour of their own chosen", () => {
      recordAtFirstCabinet("LegColor", "None");
      renderMakoColorStep();

      expect(isPressed("On")).toBe(true);
      expect(legColorSection().queryByText("None")).toBeNull();
      expect(legColorSection().queryByText("Other")).toBeNull();
      expect(legColorSection().getAllByText("Gold").some(isChosen)).toBe(false);
      // Only the legs switch on and off: the cabinet colour has no switch.
      expect(
        within(screen.getByRole("region", { name: "Cabinet Color" })).queryByRole("button", { name: "On" }),
      ).toBeNull();
    });

    it("are not offered on one-drawer cabinets, which have no legs, and are on two-drawer ones", () => {
      store.dispatch(syncCabinets(["Sink-Base-1", "Sink-Base-2"]));
      store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-1", value: "1" }));
      store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-2", value: "1" }));
      renderMakoColorStep();

      expect(screen.queryByRole("region", { name: "Leg Color" })).toBeNull();
      expect(screen.getByRole("region", { name: "Handle Color" })).toBeTruthy();

      cleanup();
      store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-1", value: "2" }));
      store.dispatch(setPlacedCabinetStyle({ id: "Sink-Base-2", value: "2" }));
      renderMakoColorStep();

      expect(screen.getByRole("region", { name: "Leg Color" })).toBeTruthy();
    });

    it("are switched on in a colour of their own, shown as chosen", () => {
      recordAtFirstCabinet("LegColor", "Gold");
      renderMakoColorStep();

      expect(isPressed("On")).toBe(true);
      expect(legColorSection().getAllByText("Gold").some(isChosen)).toBe(true);
      expect(legColorSection().queryByText("None")).toBeNull();
    });
  });

  it("offers an Urban Low Height groove colour for the upper groove, with None first, and none for push-to-open", () => {
    store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut" }));
    renderColorStep();

    const groove = within(screen.getByRole("region", { name: "Handle Groove Color (Optional)" }));
    const none = groove.getByText("None");
    expect(none.compareDocumentPosition(groove.getByText("Pulpis Chiaro TKH"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    cleanup();
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));
    renderColorStep();

    expect(screen.queryByRole("region", { name: "Handle Groove Color (Optional)" })).toBeNull();
  });

  it("leaves out the Urban Low Height fluting section, which the collection switches off", () => {
    renderColorStep();

    expect(screen.queryByRole("region", { name: "Drawer Panel Fluting" })).toBeNull();
  });

  it("lays its filters out in one row across the section, as the Urban colour sections do", () => {
    renderColorStep();

    const section = within(screen.getByRole("region", { name: "Cabinet Color" }));
    const filterRow = section.getByText("Material").closest(`.${colorFieldStyles.filters}`);

    expect(filterRow).not.toBeNull();
  });
});
