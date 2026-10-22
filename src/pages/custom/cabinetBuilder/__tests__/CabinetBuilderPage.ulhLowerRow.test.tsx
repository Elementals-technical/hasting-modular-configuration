// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  reset,
  setActiveProfile,
  setCabinetCatalog,
  setHasBootstrappedCabinetBuilder,
} from "@/entities/product/model/store/slice";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import type { SceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * The client's Urban Low Height Multi-Level composition (22.10): the countertop row is 265 cm of a 270 cm
 * maximum, the lower row 165 cm. A cabinet in the lower row does not lengthen the countertop, so the
 * types that fit there stay on; a Sink Base stays in the countertop's row.
 */

const scene = vi.hoisted(() => ({ groups: null as SceneSupportGroups | null }));

vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  readSceneSupportGroups: () => scene.groups,
}));
vi.mock("@/features/configurator-rule-core/countertop/hooks/useMaxCountertopLength", () => ({
  useMaxCountertopLength: () => 270,
}));
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const ulhProfile = (() => {
  const result = parseProductProfile(ulhProfileDocument);
  if (!result.ok) throw new Error("Urban Low Height profile must parse");

  return result.profile;
})();

const ulhCollection = buildReadyCollection("urban-low-height", ulhManifest, ulhUi);
const catalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile);

const UPPER: [string, number][] = [
  ["ULH-sink-cabinet-a1", 120],
  ["ULH-side-cabinet-b2", 25],
  ["ULH-side-cabinet-c3", 60],
  ["ULH-side-cabinet-d4", 25],
  ["ULH-side-cabinet-e5", 35],
];
const LOWER: [string, number][] = [
  ["ULH-side-cabinet-f6", 25],
  ["ULH-side-cabinet-g7", 70],
  ["ULH-side-cabinet-h8", 70],
];

const twoRows = (lower: [string, number][]): SceneSupportGroups => ({
  layout: "rows",
  countertopGroupId: "group-1",
  cabinets: [
    ...UPPER.map(([id, widthCm]) => ({ id, supportGroupId: "group-1", widthCm })),
    ...lower.map(([id, widthCm]) => ({ id, supportGroupId: "layout-lower", widthCm })),
  ],
  sidePanelsByGroup: {},
});

const card = (title: string) => screen.getByText(title).closest('[class*="productOption"]');
const isOffered = (title: string) => !card(title)?.className.includes("disabledOption");

const renderBuilderWith = (lower: [string, number][]) => {
  store.dispatch(recordComposition({ productIds: [...UPPER, ...lower].map(([id]) => id) }));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=urban-low-height"]}>
        <ReadyCollectionContext.Provider value={ulhCollection}>
          <CabinetBuilderPage />
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ulhProfile));
  store.dispatch(setActiveCollectionId("urban-low-height"));
  store.dispatch(setActiveRuntimeBindings(ulhRuntimeBindings));
  store.dispatch(setCabinetCatalog(catalog));
  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  // The countertop rests on the upper row: 265 cm.
  act(() =>
    setCountertopRuntimeState({ readiness: "ready", productId: "Top_Solid-1", compositionId: "c-1", autoLength: 2.65 }),
  );
});

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
  scene.groups = null;
});

describe("Urban Low Height cabinet types with the countertop row full", () => {
  it("offers the cabinets that fit the lower row, and keeps the Sink Base in the countertop's row", () => {
    scene.groups = twoRows(LOWER);
    renderBuilderWith(LOWER);

    expect(isOffered("Side Cabinet")).toBe(true);
    expect(isOffered("Open Shelf")).toBe(true);
    expect(isOffered("Sink Base")).toBe(false);
  });

  it("offers nothing once the lower row has no room either", () => {
    // 255 cm: 15 cm left, less than the narrowest cabinet.
    const fullLower: [string, number][] = [...LOWER, ["ULH-side-cabinet-i9", 90]];
    scene.groups = twoRows(fullLower);
    renderBuilderWith(fullLower);

    expect(isOffered("Side Cabinet")).toBe(false);
    expect(isOffered("Open Shelf")).toBe(false);
    expect(isOffered("Sink Base")).toBe(false);
  });

  it("judges one row as before when the scene tells no rows apart", () => {
    renderBuilderWith(LOWER);

    expect(isOffered("Side Cabinet")).toBe(false);
    expect(isOffered("Open Shelf")).toBe(false);
    expect(isOffered("Sink Base")).toBe(false);
  });
});
