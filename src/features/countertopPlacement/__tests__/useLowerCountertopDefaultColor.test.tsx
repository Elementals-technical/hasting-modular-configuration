// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import {
  collectionSkuProfileSchema,
  parseProductProfile,
  parseRuntimeBindings,
  ReadyCollectionContext,
} from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import { resetConfiguration, setActiveRuntimeBindings, setAttributeValue } from "@/entities/configuration";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { setActiveProfile } from "@/entities/product/model/store/slice";
import type { CabinetCoverColorState, CabinetCoverConfigureResult } from "@/features/configuratorApi";
import { setCabinetCoverRuntime } from "@/shared/lib/cabinetCoverRuntime";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import duplexManifest from "../../../../public/collections/urban-duplex/manifest.json";
import duplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import duplexBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import duplexSkuDocument from "../../../../public/collections/urban-duplex/sku-profile.json";
import duplexUi from "../../../../public/collections/urban-duplex/ui.json";
import ulhManifest from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhSkuDocument from "../../../../public/collections/urban-low-height/sku-profile.json";
import ulhUi from "../../../../public/collections/urban-low-height/ui.json";
import { useLowerCountertopDefaultColor } from "../lib/useLowerCountertopDefaultColor";

const api = vi.hoisted(() => ({ read: vi.fn(), change: vi.fn() }));
vi.mock("@/features/configuratorApi", () => ({
  createConfiguratorBridge: () => ({ getCabinetCoverColorState: api.read, setCabinetCoverColor: api.change }),
}));

// The collection with its SKU profile and its configurator, whose Countertop Color palette the Lower comes in.
const collectionOf = (id: string, manifest: unknown, ui: unknown, skuDocument: unknown, configurator: unknown) => {
  const base = buildReadyCollection(id, manifest, ui);
  const groups = (configurator as { availableOptions: unknown }).availableOptions as ConfiguratorAvailableOption[];
  return {
    ...base,
    catalog: {
      ...base.catalog,
      configurator: { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) },
      skuProfile: collectionSkuProfileSchema.parse(skuDocument),
    },
  };
};
const DUPLEX = collectionOf("urban-duplex", duplexManifest, duplexUi, duplexSkuDocument, configurator13);
const LOW_HEIGHT = collectionOf("urban-low-height", ulhManifest, ulhUi, ulhSkuDocument, configurator4);
const duplexProfile = parseProductProfile(duplexProfileDocument);
if (!duplexProfile.ok) throw new Error("Invalid Urban Duplex profile");
const ulhProfile = parseProductProfile(ulhProfileDocument);
if (!ulhProfile.ok) throw new Error("Invalid Urban Low Height profile");
const duplexBindings = parseRuntimeBindings(duplexBindingsDocument);
if (!duplexBindings.ok) throw new Error("Invalid Urban Duplex bindings");

// The material the composition asks its covers for.
let requested: string | null;
const record = (attributeId: string, scope: "global" | "countertop", value: string) =>
  act(() => {
    store.dispatch(setAttributeValue({ attributeId, target: { scope }, value }));
  });
const layCover = () =>
  act(() => {
    setCountertopRuntimeState({ readiness: "ready", compositionId: "cabinets", productId: "top" });
    setCabinetCoverRuntime({
      compositionId: "cabinets",
      covers: [{ widthCm: 75, cabinetIds: ["UD-side-cabinet-1"], materialId: "Bianco Calce DA ST" }],
    });
  });
const render = (collection: typeof DUPLEX) =>
  renderHook(useLowerCountertopDefaultColor, {
    wrapper: ({ children }: PropsWithChildren) => (
      <Provider store={store}>
        <ReadyCollectionContext.Provider value={collection}>{children}</ReadyCollectionContext.Provider>
      </Provider>
    ),
  });

const readCovers = async (): Promise<CabinetCoverColorState> => ({
  compositionId: "cabinets",
  segments: [],
  requestedMaterialId: requested,
});
const configureCovers = async (materialId: string): Promise<CabinetCoverConfigureResult> => {
  requested = materialId;
  return { status: "unchanged" };
};

beforeEach(() => {
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveRuntimeBindings(null));
  store.dispatch(setActiveProfile(duplexProfile.profile));
  requested = null;
  api.read.mockReset().mockImplementation(readCovers);
  api.change.mockReset().mockImplementation(configureCovers);
});
afterEach(() => {
  cleanup();
  setCabinetCoverRuntime(null);
  setCountertopRuntimeState(null);
});

describe("the Urban Duplex Lower in the Lateral Panel colour until another is chosen", () => {
  it("asks the scene for the Lateral Panel colour once covers are laid, and follows it, not the Upper", async () => {
    record("LateralPanelColor", "global", "Rox Black TKQ");
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Rox Black TKQ"));

    record("CountertopColor", "countertop", "Bianco Male TFA");
    record("LateralPanelColor", "global", "Ardesia TKF");
    await waitFor(() => expect(api.change).toHaveBeenLastCalledWith("Ardesia TKF"));
    expect(api.change).toHaveBeenCalledTimes(2);
  });

  it("takes the collection's Lateral Panel colour while none is recorded", async () => {
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Pulpis Chiaro TKH"));
  });

  it("keeps a colour chosen on the Lower tab, or one a restored composition asks for", async () => {
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Pulpis Chiaro TKH"));

    requested = "Aosta Green Marble Lucidato TR4";
    record("LateralPanelColor", "global", "Ardesia TKF");
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
    expect(api.change).toHaveBeenCalledTimes(1);
    cleanup();

    api.change.mockClear();
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(3));
    expect(api.change).not.toHaveBeenCalled();
  });

  it("asks nothing before covers are laid", async () => {
    render(DUPLEX);
    await act(async () => {});
    expect(api.read).not.toHaveBeenCalled();
    expect(api.change).not.toHaveBeenCalled();
  });
});

// The Lower comes in the Upper's colours (user, 2026-10-28): a default off that palette is not one.
describe("the Lower in the Upper's colours", () => {
  it("takes the Upper's colour while the Lateral Panel's is not one of the Upper's, and the Lateral's once it is", async () => {
    record("LateralPanelColor", "global", "Agata BD ST");
    record("CountertopColor", "countertop", "Bianco Male TFA");
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Bianco Male TFA"));

    record("LateralPanelColor", "global", "Ardesia TKF");
    await waitFor(() => expect(api.change).toHaveBeenLastCalledWith("Ardesia TKF"));
    expect(api.change).toHaveBeenCalledTimes(2);
  });

  it("replaces a colour a restored composition asks for that the Upper does not come in", async () => {
    requested = "Bianco Calce DA ST";
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Pulpis Chiaro TKH"));
  });

  it("asks the scene for the colour as the countertop binding names it", async () => {
    act(() => {
      store.dispatch(setActiveRuntimeBindings(duplexBindings.bindings));
    });
    record("LateralPanelColor", "global", "Agata BD ST");
    record("CountertopColor", "countertop", "Matte White");
    render(DUPLEX);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Solid Surface Matte White"));

    // Read back under the scene's name, it is the colour followed, not one chosen on the Lower tab.
    record("CountertopColor", "countertop", "Ardesia TKF");
    await waitFor(() => expect(api.change).toHaveBeenLastCalledWith("Ardesia TKF"));
  });

  it("follows the Upper on Urban Low Height, which names no colour of its own for the Lower", async () => {
    act(() => {
      store.dispatch(setActiveProfile(ulhProfile.profile));
    });
    // Configurator 4's countertop colours here: Ardesia TKF and Brera Brown TKN.
    record("CountertopColor", "countertop", "Ardesia TKF");
    render(LOW_HEIGHT);
    layCover();
    await waitFor(() => expect(api.change).toHaveBeenCalledWith("Ardesia TKF"));

    record("CountertopColor", "countertop", "Brera Brown TKN");
    await waitFor(() => expect(api.change).toHaveBeenLastCalledWith("Brera Brown TKN"));
  });

  it("asks nothing of a collection without the cover contract", async () => {
    render({
      ...DUPLEX,
      catalog: { ...DUPLEX.catalog, skuProfile: { ...DUPLEX.catalog.skuProfile, cabinetCover: undefined } },
    });
    layCover();
    await act(async () => {});
    expect(api.read).not.toHaveBeenCalled();
    expect(api.change).not.toHaveBeenCalled();
  });
});
