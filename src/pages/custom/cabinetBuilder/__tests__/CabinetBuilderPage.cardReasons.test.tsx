// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ufManifest from "../../../../../public/collections/urban-freestanding/manifest.json";
import ufProfileDocument from "../../../../../public/collections/urban-freestanding/product-profile.json";
import ufRuntimeBindingsDocument from "../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import ufUi from "../../../../../public/collections/urban-freestanding/ui.json";
import ushManifest from "../../../../../public/collections/urban-standard-height/manifest.json";
import ushUi from "../../../../../public/collections/urban-standard-height/ui.json";
import { store } from "@/app/store";
import {
  parseProductProfile,
  parseRuntimeBindings,
  ReadyCollectionContext,
  type ProductProfile,
  type RuntimeBindingSet,
} from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";
import cabinetTable590 from "@/entities/collection/__tests__/fixtures/remote/datatable-590.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setCountertopColorSku,
  setDrawerProduct,
  setHasBootstrappedCabinetBuilder,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { ReasonTextProvider } from "@/features/collectionCustomization";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * Why a card of the builder is greyed: the page hands each type and style card the first reason that
 * holds, in this order: the countertop's cabinet limit (Syntesi), the limit of the type, a shelf
 * before any base cabinet, a Side Shelf's handle, the countertop's length; a style card also its
 * series and a short cabinet's taller neighbour. The cards are read as the page hands them over: a
 * reason without a code still reads as the generic text on screen, so the hint cannot tell them apart.
 */

type CardData = {
  title: string;
  isAvailable?: boolean;
  disabledReason?: string;
  disabledReasonCode?: string;
  disabledActionLabel?: string;
};

const cards = vi.hoisted(() => ({ types: [] as CardData[], styles: [] as CardData[] }));

vi.mock("@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid", () => ({
  ProductOptionsGrid: ({ data }: { data: CardData[] }) => {
    cards.types = data;
    return null;
  },
}));
vi.mock("@/entities/product/ui/ProductStyleGrid/ProductStyleGrid", () => ({
  ProductStyleGrid: ({ data }: { data: CardData[] }) => {
    cards.styles = data;
    return null;
  },
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

const SYNTESI = "Syntesi is available for single cabinet configurations only.";
const SINK_BASE_LIMIT = "Vanity configurations allow a maximum of two Sink Base units.";
const ADD_BASE_FIRST = "Add at least one Sink Base or Side Cabinet first.";
const PTO_ONLY = "This cabinet type is only compatible with a PTO handle.";
const LENGTH_REACHED = 'Maximum composition length reached for the selected countertop setup (270 cm / 106.3").';
const UF_NEEDS_TALL_CABINET =
  "Add a 2 Drawer Sink Base or Side Cabinet first: the short cabinet stands beside a taller one.";
/** An Urban Standard Height handle with a groove, which a Side Shelf does not take. */
const GROOVE_HANDLE = "handle_urban_topcut";

const ufProfile = (() => {
  const result = parseProductProfile(ufProfileDocument);
  if (!result.ok) throw new Error("the packaged Urban Freestanding profile must parse");

  return result.profile;
})();

const ufRuntimeBindings = (() => {
  const result = parseRuntimeBindings(ufRuntimeBindingsDocument);
  if (!result.ok) throw new Error("the packaged Urban Freestanding runtime bindings must parse");

  return result.bindings;
})();

type Collection = {
  id: string;
  manifest: unknown;
  ui: unknown;
  profile: ProductProfile;
  bindings: RuntimeBindingSet;
  cabinetTable: unknown;
};

const USH: Collection = {
  id: "urban-standard-height",
  manifest: ushManifest,
  ui: ushUi,
  profile: ushProfile,
  bindings: ushRuntimeBindings,
  cabinetTable: cabinetTable439,
};
const UF: Collection = {
  id: "urban-freestanding",
  manifest: ufManifest,
  ui: ufUi,
  profile: ufProfile,
  bindings: ufRuntimeBindings,
  cabinetTable: cabinetTable590,
};

type Setup = {
  /** The cabinet type chosen last, whose styles the page shows. */
  adding?: string;
  /** The handle the next cabinet takes. */
  handle?: string;
  countertopSku?: string;
  /** The countertop is 265 cm of its 270 cm maximum. */
  countertopFull?: boolean;
};

/** The builder of a collection with `placed` standing in the scene. */
const renderBuilder = (
  { id, manifest, ui, profile, bindings, cabinetTable }: Collection,
  placed: string[],
  { adding, handle, countertopSku, countertopFull }: Setup = {},
) => {
  const catalog = buildCabinetCatalogFromMatrix(cabinetTable as ProductDatatable, profile, bindings);
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId(id));
  store.dispatch(setActiveRuntimeBindings(bindings));
  store.dispatch(setHasBootstrappedCabinetBuilder(true));
  store.dispatch(recordComposition({ productIds: placed }));
  if (adding) {
    store.dispatch(setActiveCabinetType(adding));
    store.dispatch(setDrawerProduct(adding));
  }
  if (handle) store.dispatch(setSelectedProductConfig({ Handle: handle }));
  if (countertopSku) store.dispatch(setCountertopColorSku(countertopSku));
  if (countertopFull) {
    act(() =>
      setCountertopRuntimeState({
        readiness: "ready",
        productId: "Top_Solid-1",
        compositionId: "c-1",
        autoLength: 2.65,
      }),
    );
  }

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/custom/cabinet-builder?collectionId=${id}`]}>
        <ReadyCollectionContext.Provider value={buildReadyCollection(id, manifest, ui)}>
          <ReasonTextProvider>
            <CabinetBuilderPage />
          </ReasonTextProvider>
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};

/** What the page hands a card about whether it can be chosen, and why not. */
const why = (card: CardData | undefined) => ({
  isAvailable: card?.isAvailable,
  reason: card?.disabledReason,
  code: card?.disabledReasonCode,
  action: card?.disabledActionLabel,
});
const typeCard = (title: string) => why(cards.types.find((card) => card.title === title));
const styleCards = () => cards.styles.map(why);

beforeEach(() => {
  cards.types = [];
  cards.styles = [];
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

afterEach(() => {
  cleanup();
  act(() => setCountertopRuntimeState(null));
});

describe("a greyed type card", () => {
  it("names the countertop's one cabinet first, before the limit of the type", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Sink-Base-test2"], { countertopSku: "SSSYN" });

    const syntesi = { isAvailable: false, reason: SYNTESI, code: undefined, action: undefined };
    expect(typeCard("Sink Base")).toEqual(syntesi);
    expect(typeCard("Side Cabinet")).toEqual(syntesi);
  });

  it("names the limit of the type by its code", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Sink-Base-test2"]);

    expect(typeCard("Sink Base")).toEqual({
      isAvailable: false,
      reason: SINK_BASE_LIMIT,
      code: "cabinet.sinkBaseLimit",
      action: undefined,
    });
    expect(typeCard("Side Cabinet").isAvailable).toBe(true);
  });

  it("asks for a base cabinet before a shelf, whatever the handle", () => {
    renderBuilder(USH, [], { handle: GROOVE_HANDLE });

    const addBaseFirst = { isAvailable: false, reason: ADD_BASE_FIRST, code: undefined, action: undefined };
    expect(typeCard("Open Shelf")).toEqual(addBaseFirst);
    expect(typeCard("Side Shelf")).toEqual(addBaseFirst);
  });

  it("asks for a PTO handle for a Side Shelf, and offers to switch to one", () => {
    renderBuilder(USH, ["Sink-Base-test1"], { handle: GROOVE_HANDLE });

    expect(typeCard("Side Shelf")).toEqual({
      isAvailable: false,
      reason: PTO_ONLY,
      code: undefined,
      action: "Switch to PTO handle here",
    });
  });

  it("names the countertop's length once no cabinet fits", () => {
    renderBuilder(USH, ["Sink-Base-test1"], { countertopFull: true });

    expect(typeCard("Side Cabinet")).toEqual({
      isAvailable: false,
      reason: LENGTH_REACHED,
      code: undefined,
      action: undefined,
    });
  });
});

describe("a greyed style card", () => {
  it("names the countertop's one cabinet first, before the limit of the type", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Sink-Base-test2"], { adding: "Sink-Base", countertopSku: "SSSYN" });

    expect(styleCards().length).toBeGreaterThan(0);
    for (const card of styleCards()) {
      expect(card).toMatchObject({ isAvailable: false, reason: SYNTESI, code: undefined });
    }
  });

  it("names the limit of the type by its code", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Sink-Base-test2"], { adding: "Sink-Base" });

    expect(styleCards().length).toBeGreaterThan(0);
    for (const card of styleCards()) {
      expect(card).toMatchObject({ isAvailable: false, reason: SINK_BASE_LIMIT, code: "cabinet.sinkBaseLimit" });
    }
  });

  it("names the countertop's length once no cabinet of the type fits", () => {
    renderBuilder(USH, ["Sink-Base-test1"], { adding: "Sink-Cabinet", countertopFull: true });

    expect(styleCards().length).toBeGreaterThan(0);
    for (const card of styleCards()) {
      expect(card).toMatchObject({ isAvailable: false, reason: LENGTH_REACHED, code: undefined });
    }
  });

  it("asks for a taller cabinet before a short one, by its code", () => {
    renderBuilder(UF, [], { adding: "Short-Cabinet" });

    expect(styleCards()).toContainEqual({
      isAvailable: false,
      reason: UF_NEEDS_TALL_CABINET,
      code: "drawers.steppedNeedsTallCabinet",
      action: undefined,
    });
  });
});
