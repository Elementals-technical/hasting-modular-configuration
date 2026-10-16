// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { collectionSkuProfileSchema, parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { resetConfiguration, setAttributeValue } from "@/entities/configuration";
import { setActiveProfile } from "@/entities/product/model/store/slice";
import type { CabinetCoverColorState, CabinetCoverConfigureResult } from "@/features/configuratorApi";
import { setCabinetCoverRuntime } from "@/shared/lib/cabinetCoverRuntime";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import duplexManifest from "../../../../public/collections/urban-duplex/manifest.json";
import duplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import duplexSkuDocument from "../../../../public/collections/urban-duplex/sku-profile.json";
import duplexUi from "../../../../public/collections/urban-duplex/ui.json";
import ulhManifest from "../../../../public/collections/urban-low-height/manifest.json";
import ulhSkuDocument from "../../../../public/collections/urban-low-height/sku-profile.json";
import ulhUi from "../../../../public/collections/urban-low-height/ui.json";
import { useLowerCountertopDefaultColor } from "../lib/useLowerCountertopDefaultColor";

const api = vi.hoisted(() => ({ read: vi.fn(), change: vi.fn() }));
vi.mock("@/features/configuratorApi", () => ({
  createConfiguratorBridge: () => ({ getCabinetCoverColorState: api.read, setCabinetCoverColor: api.change }),
}));

const collectionOf = (id: string, manifest: unknown, ui: unknown, skuDocument: unknown) => {
  const base = buildReadyCollection(id, manifest, ui);
  return { ...base, catalog: { ...base.catalog, skuProfile: collectionSkuProfileSchema.parse(skuDocument) } };
};
const DUPLEX = collectionOf("urban-duplex", duplexManifest, duplexUi, duplexSkuDocument);
const LOW_HEIGHT = collectionOf("urban-low-height", ulhManifest, ulhUi, ulhSkuDocument);
const duplexProfile = parseProductProfile(duplexProfileDocument);
if (!duplexProfile.ok) throw new Error("Invalid Urban Duplex profile");

// The colour the composition asks its covers for; scene v53 keeps the slab in the cabinet's colour.
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

  it("asks nothing before covers are laid, or of a collection that names no default", async () => {
    const duplex = render(DUPLEX);
    await act(async () => {});
    expect(api.read).not.toHaveBeenCalled();
    duplex.unmount();

    render(LOW_HEIGHT);
    layCover();
    await act(async () => {});
    expect(api.read).not.toHaveBeenCalled();
    expect(api.change).not.toHaveBeenCalled();
  });
});
