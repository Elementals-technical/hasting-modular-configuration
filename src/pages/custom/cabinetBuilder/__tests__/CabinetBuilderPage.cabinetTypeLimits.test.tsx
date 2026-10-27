// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import classManifest from "../../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import classUi from "../../../../../public/collections/class/ui.json";
import makoManifest from "../../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../../public/collections/mako/ui.json";
import udManifest from "../../../../../public/collections/urban-duplex/manifest.json";
import udProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import udRuntimeBindingsDocument from "../../../../../public/collections/urban-duplex/runtime-bindings.json";
import udUi from "../../../../../public/collections/urban-duplex/ui.json";
import ulhManifest from "../../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../public/collections/urban-low-height/ui.json";
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
import cabinetTable579 from "@/entities/collection/__tests__/fixtures/remote/datatable-579.json";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import cabinetTable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import cabinetTable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  recordComposition,
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setDrawerProduct,
  setHasBootstrappedCabinetBuilder,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { ReasonTextProvider } from "@/features/collectionCustomization";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

/**
 * A vanity takes at most two Sink Bases and two Side Shelves, in every collection. At the limit
 * the type card is greyed, and resting on it says why: in the words of the Urban Standard Height
 * configurator, unless the collection words it its own way (`cabinet.sinkBaseLimit`,
 * `cabinet.sideShelfLimit` in its `messages`). The styles of that type are greyed the same way, so
 * none of them opens the "+" for one more.
 */

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

const SINK_BASE_LIMIT = "Vanity configurations allow a maximum of two Sink Base units.";
const SIDE_SHELF_LIMIT = "Vanity configurations allow a maximum of two Side Shelf units.";
/** Urban Duplex and Urban Freestanding call the type Open Side Shelf, and say so in their `messages`. */
const OPEN_SIDE_SHELF_LIMIT = "Vanity configurations allow a maximum of two Open Side Shelf units.";
/** An Urban Standard Height handle with a groove, which a Side Shelf does not take. */
const GROOVE_HANDLE = "handle_urban_topcut";

const parsedProfile = (document: unknown, name: string) => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(`the packaged ${name} profile must parse`);

  return result.profile;
};

const parsedBindings = (document: unknown, name: string) => {
  const result = parseRuntimeBindings(document);
  if (!result.ok) throw new Error(`the packaged ${name} runtime bindings must parse`);

  return result.bindings;
};

type Collection = {
  id: string;
  manifest: unknown;
  ui: unknown;
  profile: ProductProfile;
  bindings: RuntimeBindingSet;
  catalog: ConfiguratorCatalog;
  /** The scene type a Sink Base is placed as: the scene names each one after it. */
  sinkBaseScene: string;
};

/** Built as the loader builds it, with the scene product of each cabinet type. */
const collection = (
  id: string,
  documents: { manifest: unknown; ui: unknown; cabinetTable: unknown },
  profile: ProductProfile,
  bindings: RuntimeBindingSet,
  sinkBaseScene: string,
): Collection => ({
  id,
  manifest: documents.manifest,
  ui: documents.ui,
  profile,
  bindings,
  catalog: buildCabinetCatalogFromMatrix(documents.cabinetTable as ProductDatatable, profile, bindings),
  sinkBaseScene,
});

const USH = collection(
  "urban-standard-height",
  { manifest: ushManifest, ui: ushUi, cabinetTable: cabinetTable439 },
  ushProfile,
  ushRuntimeBindings,
  "Sink-Base",
);
const MAKO = collection(
  "mako",
  { manifest: makoManifest, ui: makoUi, cabinetTable: cabinetTable581 },
  makoProfile,
  makoRuntimeBindings,
  "Mako-sink-cabinet",
);
const UD = collection(
  "urban-duplex",
  { manifest: udManifest, ui: udUi, cabinetTable: cabinetTable594 },
  parsedProfile(udProfileDocument, "Urban Duplex"),
  parsedBindings(udRuntimeBindingsDocument, "Urban Duplex"),
  "UD-sink-cabinet",
);
const COLLECTIONS = [
  USH,
  collection(
    "urban-low-height",
    { manifest: ulhManifest, ui: ulhUi, cabinetTable: cabinetTable580 },
    parsedProfile(ulhProfileDocument, "Urban Low Height"),
    ulhRuntimeBindings,
    "ULH-sink-cabinet",
  ),
  MAKO,
  collection(
    "class",
    { manifest: classManifest, ui: classUi, cabinetTable: cabinetTable579 },
    parsedProfile(classProfileDocument, "Class"),
    classRuntimeBindings,
    "Class-sink-cabinet",
  ),
];

/**
 * The builder of a collection with `placed` standing in the scene; `adding` is the cabinet type chosen
 * last, whose styles the page shows, and `handle` the handle the next cabinet takes.
 */
const renderBuilder = (
  { id, manifest, ui, profile, bindings, catalog }: Collection,
  placed: string[],
  { adding, handle }: { adding?: string; handle?: string } = {},
) => {
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

const typeCard = (title: string) => screen.getByRole("button", { name: title });
const isOff = (title: string) => typeCard(title).getAttribute("aria-disabled") === "true";
/** Rests the pointer on a card; a greyed one then says why. */
const hover = (title: string) =>
  fireEvent.mouseEnter(typeCard(title).closest('[class*="productOption"]') as HTMLElement);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

afterEach(cleanup);

describe.each(COLLECTIONS)("Sink Bases in $id", (current) => {
  const sinkBases = (count: number) =>
    Array.from({ length: count }, (_, index) => `${current.sinkBaseScene}-test${index + 1}`);

  it("greys the Sink Base card at two and says why", () => {
    renderBuilder(current, sinkBases(2));

    expect(isOff("Sink Base")).toBe(true);
    hover("Sink Base");
    expect(screen.getByText(SINK_BASE_LIMIT)).toBeTruthy();
    expect(screen.queryByText("Not available for selected configuration")).toBeNull();
  });

  it("offers the Sink Base card beside one", () => {
    renderBuilder(current, sinkBases(1));

    expect(isOff("Sink Base")).toBe(false);
  });
});

describe.each([
  { name: "urban-standard-height", current: USH, title: "Side Shelf", scene: "Side-Shelf", limit: SIDE_SHELF_LIMIT },
  {
    name: "urban-duplex",
    current: UD,
    title: "Open Side Shelf",
    scene: "UD-open-shelves-side",
    limit: OPEN_SIDE_SHELF_LIMIT,
  },
])("Side Shelves in $name", ({ current, title, scene, limit }) => {
  it("greys the card at two and says why, in the collection's words", () => {
    renderBuilder(current, [`${current.sinkBaseScene}-test1`, `${scene}-test2`, `${scene}-test3`]);

    expect(isOff(title)).toBe(true);
    hover(title);
    expect(screen.getByText(limit)).toBeTruthy();
  });
});

describe("the styles of a type at its limit", () => {
  it("are greyed and say why, so none of them opens the + for one more", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Sink-Base-test2"], { adding: "Sink-Base" });

    const styles = within(screen.getByRole("region", { name: "Cabinet Style" })).getAllByRole("button");
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.map((style) => style.getAttribute("aria-disabled"))).toEqual(styles.map(() => "true"));

    fireEvent.mouseEnter(styles[0].closest('[class*="productStyleItem"]') as HTMLElement);
    expect(screen.getByText(SINK_BASE_LIMIT)).toBeTruthy();
  });
});

describe("the switch to a handle a Side Shelf takes", () => {
  it("is offered while the vanity takes another Side Shelf", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Side-Shelf-test2"], { handle: GROOVE_HANDLE });

    expect(screen.getByText("Switch to PTO handle here")).toBeTruthy();
  });

  it("is not offered at two Side Shelves: another handle would not make room for a third", () => {
    renderBuilder(USH, ["Sink-Base-test1", "Side-Shelf-test2", "Side-Shelf-test3"], { handle: GROOVE_HANDLE });

    expect(isOff("Side Shelf")).toBe(true);
    expect(screen.queryByText("Switch to PTO handle here")).toBeNull();
  });
});

describe("a collection that words the limit itself", () => {
  it("shows its own words", () => {
    const profile: ProductProfile = {
      ...makoProfile,
      messages: { ...makoProfile.messages, "cabinet.sinkBaseLimit": "Two Sink Bases at most." },
    };
    renderBuilder({ ...MAKO, profile }, ["Mako-sink-cabinet-test1", "Mako-sink-cabinet-test2"]);

    hover("Sink Base");
    expect(screen.getByText("Two Sink Bases at most.")).toBeTruthy();
  });
});
