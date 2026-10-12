// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { collectionSkuProfileSchema, parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { resetConfiguration } from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";

import manifest from "../../../../public/collections/urban-low-height/manifest.json";
import profileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ui from "../../../../public/collections/urban-low-height/ui.json";
import skuDocument from "../../../../public/collections/urban-low-height/sku-profile.json";
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
