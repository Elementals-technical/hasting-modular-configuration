// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { collectionSkuProfileSchema, parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { resetConfiguration } from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";

import manifest from "../../../../public/collections/urban-low-height/manifest.json";
import profileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ui from "../../../../public/collections/urban-low-height/ui.json";
import skuDocument from "../../../../public/collections/urban-low-height/sku-profile.json";
import duplexManifest from "../../../../public/collections/urban-duplex/manifest.json";
import duplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import duplexSkuDocument from "../../../../public/collections/urban-duplex/sku-profile.json";
import duplexUi from "../../../../public/collections/urban-duplex/ui.json";
import { FieldsStepPage } from "../FieldsStepPage";

const mocks = vi.hoisted(() => ({ read: vi.fn(), lower: vi.fn(), upper: vi.fn() }));
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));
vi.mock("@/features/configuratorApi", async (original) => ({
  ...(await original<typeof import("@/features/configuratorApi")>()),
  createConfiguratorBridge: () => ({ getCabinetCoverColorState: mocks.read, setCabinetCoverColor: mocks.lower }),
}));
vi.mock("@/features/configurationCommands", async (original) => ({
  ...(await original<typeof import("@/features/configurationCommands")>()),
  useAttributeChangeHandler: (attributeId: string) => ({
    onChange: (value: string) => mocks.upper(attributeId, value),
    notice: null,
  }),
  useFieldAutoSelect: () => undefined,
}));

const group: ConfiguratorAvailableOption = {
  id: 1,
  proxyName: "Countertop Color",
  proxyType: "material",
  enabled: true,
  metadata: {},
  options: [
    {
      id: 10,
      name: "HPL",
      resource: null,
      paramString: null,
      playcanvasString: null,
      variants: ["Rox Black TKQ", "Pulpis Chiaro TKH"].map((name, index) => ({
        id: 100 + index,
        name,
        image: null,
        enabled: true,
        description: "",
        metadata: { value: name, sku: "TKH", Material: "HPL" },
      })),
    },
  ],
};
const parsed = parseProductProfile(profileDocument);
const cabinetGroup: ConfiguratorAvailableOption = {
  ...group,
  id: 2,
  proxyName: "Cabinet Color",
  options: [
    {
      ...group.options[0],
      name: "3D",
      variants: [
        {
          ...group.options[0].variants[0],
          name: "Castagno chiaro 1C1",
          metadata: { value: "Castagno chiaro 1C1", label: "Castagno Chiaro 1C1", sku: "3D", Material: "3D" },
        },
      ],
    },
  ],
};
if (!parsed.ok) throw new Error("Invalid ULH profile");
const base = buildReadyCollection("urban-low-height", manifest, ui);
const collection = {
  ...base,
  catalog: {
    ...base.catalog,
    configurator: {
      groups: [group, cabinetGroup],
      groupsByName: { "Countertop Color": group, "Cabinet Color": cabinetGroup },
    },
    skuProfile: collectionSkuProfileSchema.parse(skuDocument),
    countertops: parseCountertopMatrix(datatable589 as unknown as CountertopDatatable),
  },
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(parsed.profile));
  let materialId = "Rox Black TKQ";
  mocks.read.mockReset().mockImplementation(async () => ({
    compositionId: "cabinets",
    segments: [
      {
        productId: "cover",
        cabinetIds: ["cabinet"],
        widthM: 0.9,
        depthM: 0.44,
        thicknessM: 0.0127,
        materialId,
      },
    ],
  }));
  mocks.lower.mockReset().mockImplementation(async (value: string) => {
    materialId = value;
    return { status: "applied" };
  });
  mocks.upper.mockReset().mockResolvedValue({ status: "applied", plan: [] });
});
afterEach(cleanup);

it("connects Upper and Lower on the actual ULH schema-driven countertop page", async () => {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/countertop?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <FieldsStepPage stepId="countertop" />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(screen.getByRole("tab", { name: "Lower" })).toBeTruthy());
  const colors = within(screen.getByRole("region", { name: "Countertop Color" }));
  fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
  await act(async () => {
    expect(colors.queryByRole("button", { name: "Pulpis Chiaro TKH" })).toBeNull();
    fireEvent.click(colors.getByRole("button", { name: "Castagno Chiaro 1C1" }));
  });
  expect(mocks.lower).toHaveBeenCalledWith("Castagno chiaro 1C1");
  expect(mocks.upper).not.toHaveBeenCalled();
  expect(colors.getByRole("button", { name: "Castagno Chiaro 1C1" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Upper" }));
  await act(async () => {
    fireEvent.click(colors.getByRole("button", { name: "Rox Black TKQ" }));
  });
  expect(mocks.upper).toHaveBeenCalledWith("CountertopColor", "Rox Black TKQ");
  expect(mocks.lower).toHaveBeenCalledOnce();
});

// Urban Duplex offers Lower by the same contract: the cover block of its SKU profile, not its id.
const duplexParsed = parseProductProfile(duplexProfileDocument);
if (!duplexParsed.ok) throw new Error("Invalid Urban Duplex profile");
const duplexGroups = configurator13.availableOptions as unknown as ConfiguratorAvailableOption[];
const duplexBase = buildReadyCollection("urban-duplex", duplexManifest, duplexUi);
const duplexSkuProfile = collectionSkuProfileSchema.parse(duplexSkuDocument);
const duplexCollection = {
  ...duplexBase,
  catalog: {
    ...duplexBase.catalog,
    configurator: {
      groups: duplexGroups,
      groupsByName: Object.fromEntries(duplexGroups.map((item) => [item.proxyName, item])),
    },
    skuProfile: duplexSkuProfile,
    countertops: parseCountertopMatrix(datatable595 as unknown as CountertopDatatable),
  },
};

const renderDuplexCountertopStep = (value: typeof duplexCollection) => {
  store.dispatch(setActiveProfile(duplexParsed.profile));
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/prebuilt/countertop?collectionId=urban-duplex"]}>
        <ReadyCollectionContext.Provider value={value}>
          <FieldsStepPage stepId="countertop" />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

it("offers Upper and Lower on Urban Duplex once the scene publishes a cover, in the Base Panel palette", async () => {
  renderDuplexCountertopStep(duplexCollection);

  await waitFor(() => expect(screen.getByRole("tab", { name: "Lower" })).toBeTruthy());
  const colors = within(screen.getByRole("region", { name: "Countertop Color" }));
  fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
  // The scene's HPL slab reads as chosen: HPL is a material of the decorative top, as in Urban Low Height.
  await waitFor(() =>
    expect(colors.getByRole("button", { name: "Rox Black TKQ" }).getAttribute("aria-pressed")).toBe("true"),
  );
  await act(async () => {
    fireEvent.click(colors.getByRole("button", { name: "Bianco Calce DA ST" }));
  });

  expect(mocks.lower).toHaveBeenCalledWith("Bianco Calce DA ST");
  expect(mocks.upper).not.toHaveBeenCalled();
  expect(colors.getByRole("button", { name: "Bianco Calce DA ST" }).getAttribute("aria-pressed")).toBe("true");
});

it("shows no Lower for a collection without the cover contract, whatever the scene publishes", async () => {
  renderDuplexCountertopStep({
    ...duplexCollection,
    catalog: { ...duplexCollection.catalog, skuProfile: { ...duplexSkuProfile, cabinetCover: undefined } },
  });

  const colors = within(screen.getByRole("region", { name: "Countertop Color" }));
  await waitFor(() => expect(colors.getByRole("button", { name: "Pulpis Chiaro TKH" })).toBeTruthy());
  expect(screen.queryByRole("tab", { name: "Lower" })).toBeNull();
  expect(mocks.read).not.toHaveBeenCalled();
});
