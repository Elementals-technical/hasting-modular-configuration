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
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

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
              configurator: { groups: [cabinetColors], groupsByName: { "Cabinet Color": cabinetColors } },
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
    store.dispatch(setActiveProfile(parsedProfile.profile));
  });

  afterEach(cleanup);

  it("shows the configurator picture of each colour, as the Urban Standard colour screens do", () => {
    renderColorStep();

    const section = screen.getByRole("region", { name: "Cabinet Color" });
    const pictures = within(section)
      .getAllByRole("img")
      .map((image) => image.getAttribute("src"));

    expect(pictures).toContain("https://preview.threekit.com/api/files/hash/sha256-pulpis");
  });

  // Mako's section holds every colour in one option named after the attribute, so the grid can
  // only group them by the material each variant names.
  it("groups a Mako colour by the material its own configurator names", () => {
    store.dispatch(setActiveProfile(makoProfile));
    const collection = buildReadyCollection("mako", makoManifestDocument, makoUiDocument);
    const makoGroups = configurator9.availableOptions as unknown as ConfiguratorAvailableOption[];

    render(
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

    const section = within(screen.getByRole("region", { name: "Cabinet Color" }));
    expect(section.getByText("Lacquered MT")).toBeTruthy();
    expect(section.getByText("Lacquered GL")).toBeTruthy();
    expect(section.queryByText("Other")).toBeNull();
    expect(section.getAllByText("Nebbia 402 MT").length).toBeGreaterThan(0);
  });

  it("lays its filters out in one row across the section, as the Urban colour sections do", () => {
    renderColorStep();

    const section = within(screen.getByRole("region", { name: "Cabinet Color" }));
    const filterRow = section.getByText("Material").closest(`.${colorFieldStyles.filters}`);

    expect(filterRow).not.toBeNull();
  });
});
