// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import urbanDuplexManifest from "../../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexUi from "../../../../../public/collections/urban-duplex/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, parseRuntimeBindings, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import {
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * An Urban Duplex one-drawer cabinet comes at 53 cm and as the Slim 38 and 28 cm, so the style
 * groups no longer say how high a composition is. Beside Slim cabinets another one-drawer
 * cabinet goes; a cabinet with an inner drawer, 53 cm only, switches them all, after asking.
 *
 * The placed cabinets are named after their scene product (`UD-side-cabinet-…`), not after the
 * cabinet type: the switch still finds them.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  saveSnapshot: vi.fn(async () => {}),
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/entities/history/lib/useHistorySnapshot", () => ({ useHistorySnapshot: () => scene.saveSnapshot }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
    // The scene is not there to be read back.
    ensureCabinetHeights: vi.fn(async () => {}),
  };
});

const parsedProfile = parseProductProfile(urbanDuplexProfileDocument);
const parsedBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("the packaged Urban Duplex data must parse");
const profile = parsedProfile.profile;
const bindings = parsedBindings.bindings;
// Built as the loader builds it, with the scene product of each cabinet type.
const catalog = buildCabinetCatalogFromMatrix(cabinetTable594 as ProductDatatable, profile, bindings);
const collection = buildReadyCollection("urban-duplex", urbanDuplexManifest, urbanDuplexUi);

const SINK_BASE = "UD-sink-cabinet-test1";
const SIDE_CABINET = "UD-side-cabinet-test2";

const product = () => store.getState().rootStateUI.product;

/** One-drawer cabinets at `height` cm, a Sink Base and a Side Cabinet unless named; a Side Cabinet is being added. */
const placeOneDrawerCabinets = (height: number, placed: string[] = [SINK_BASE, SIDE_CABINET]) => {
  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  store.dispatch(
    recordComposition({
      productIds: placed,
      placedCabinetStyles: Object.fromEntries(placed.map((runtimeId) => [runtimeId, "1"])),
    }),
  );
  store.dispatch(syncCabinets(placed));
  store.dispatch(
    recordSceneState({
      order: placed,
      cabinets: placed.map((runtimeId) => ({ runtimeId, dimensions: { width: 60, height, depth: 50 } })),
    }),
  );
  store.dispatch(setActiveCabinetType("Sink-Cabinet"));
  store.dispatch(setSelectedProductConfig({ Handle: "UG", Drawers: "1D" }));
  store.dispatch(setSelectedDimensions({ height }));
};

const renderBuilder = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-duplex"]}>
        <ReadyCollectionContext.Provider value={collection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

const styleCard = (title: string) => screen.getByRole("button", { name: title });
/** A style that switches the placed cabinets is drawn as restricted and asks first. */
const isRestricted = (title: string) =>
  Boolean(styleCard(title).closest('[class*="productStyleItem"]')?.className.includes("restricted"));

beforeEach(() => {
  scene.runtime = null;
  scene.saveSnapshot.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("urban-duplex"));
  store.dispatch(setActiveRuntimeBindings(bindings));
});

afterEach(cleanup);

describe("Urban Duplex cabinet styles beside placed cabinets", () => {
  it("lets one more one-drawer cabinet stand beside the Slim ones, and asks before the other styles", () => {
    placeOneDrawerCabinets(38);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer With Inner Drawer")).toBe(true);
    expect(isRestricted("2 Drawer")).toBe(true);
  });

  it("lets an inner drawer stand beside the standard one-drawer cabinets, both 53 cm", () => {
    placeOneDrawerCabinets(53);
    renderBuilder();

    expect(isRestricted("1 Drawer")).toBe(false);
    expect(isRestricted("1 Drawer With Inner Drawer")).toBe(false);
    expect(isRestricted("2 Drawer")).toBe(true);
  });

  it("switches every Slim cabinet to the inner drawer and its 53 cm once the user approves", async () => {
    placeOneDrawerCabinets(38);
    renderBuilder();

    fireEvent.click(styleCard("1 Drawer With Inner Drawer"));

    // Nothing is sent or recorded until the user approves.
    await screen.findByText("Update Design?");
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().selectedDimensions.height).toBe(38);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1+inner", [SIDE_CABINET]: "1+inner" }),
    );
    expect(product().selectedDimensions.height).toBe(53);
    // One set for the scene: the drawers of each cabinet and the height they require.
    expect(scene.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(scene.runtime?.calls).toHaveLength(1);
    expect(scene.runtime?.calls[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeId: "Drawers", value: "1+inner" }),
        expect.objectContaining({ attributeId: "Height", value: 53 }),
      ]),
    );
    expect(scene.runtime?.calls[0].filter(({ attributeId }) => attributeId === "Drawers")).toHaveLength(2);
  });

  it("switches a Side Cabinet standing alone, which its scene id does not name by type", async () => {
    placeOneDrawerCabinets(38, [SIDE_CABINET]);
    renderBuilder();

    fireEvent.click(styleCard("2 Drawer"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().placedCabinetStyles).toEqual({ [SIDE_CABINET]: "2" }));
    expect(product().selectedDimensions.height).toBe(56);
    expect(scene.runtime?.calls).toHaveLength(1);
  });

  it("leaves the Slim cabinets as they are when the user cancels", async () => {
    placeOneDrawerCabinets(28);
    renderBuilder();

    fireEvent.click(styleCard("2 Drawer"));
    await screen.findByText("Update Design?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1", [SIDE_CABINET]: "1" });
    expect(product().selectedDimensions.height).toBe(28);
  });
});
