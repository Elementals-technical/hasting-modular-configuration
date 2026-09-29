// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import classManifestDocument from "../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUiDocument from "../../../../public/collections/class/ui.json";
import makoManifestDocument from "../../../../public/collections/mako/manifest.json";
import makoUiDocument from "../../../../public/collections/mako/ui.json";
import ulhManifestDocument from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUiDocument from "../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import { resetConfiguration, setActiveRuntimeBindings, syncCabinets } from "@/entities/configuration";
import {
  reset,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import type { AttributeChange, ChangeResult } from "@/features/configurationCommands";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";

import { FieldsStepPage } from "../FieldsStepPage";

/**
 * A field that declares `autoSelect` keeps a value its rules allow, as the Urban Standard Height
 * countertop step keeps its thickness and basin: Urban Low Height starts its countertop step with
 * the first thickness and basin table 438 allows, through the command.
 */

const changeMock = vi.fn<(request: AttributeChange) => Promise<ChangeResult>>(async () => ({
  status: "applied",
  plan: [],
}));
// One runner for every render, as useChangeAttribute memoizes it.
const runner = { change: changeMock, getState: () => store.getState() };

vi.mock("@/features/configurationCommands/hooks/useChangeAttribute", () => ({ useChangeAttribute: () => runner }));
vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));

// The scene's products, by runtime id, as the scene keeps them.
let sceneProducts: Record<string, Record<string, unknown>> = {};
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: () => Object.keys(sceneProducts),
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: async (productId: string) => sceneProducts[productId] ?? null,
}));
// The real accordion: only the section ui.json opens by default is mounted, as on the page, so
// the Thickness and Basin style sections are closed.
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({
  useCompactAccordionViewport: () => false,
  useShouldCollapseAccordionByDefault: () => false,
}));

afterEach(cleanup);

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");

const readyCollectionOf = (
  collectionId: string,
  manifest: unknown,
  ui: unknown,
  configurator: unknown,
  countertopTable: unknown,
) => {
  const collection = buildReadyCollection(collectionId, manifest, ui);
  const groups = configuratorSchema.parse(configurator).availableOptions;

  return {
    ...collection,
    catalog: {
      ...collection.catalog,
      configurator: { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) },
      countertops: parseCountertopMatrix(countertopDatatableSchema.parse(countertopTable)),
    },
  };
};

const urbanLowHeight = readyCollectionOf(
  "urban-low-height",
  ulhManifestDocument,
  ulhUiDocument,
  configurator4,
  datatable438,
);
const mako = readyCollectionOf("mako", makoManifestDocument, makoUiDocument, configurator9, datatable577);
const classCollection = readyCollectionOf("class", classManifestDocument, classUiDocument, configurator9, datatable578);

const parsedClassProfile = parseProductProfile(classProfileDocument);
if (!parsedClassProfile.ok) throw new Error("Class profile must parse");
const classProfile = parsedClassProfile.profile;

const renderCountertopStep = (collection: ReturnType<typeof readyCollectionOf>) =>
  render(
    <ReadyCollectionContext.Provider value={collection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/countertop"]}>
          <FieldsStepPage stepId="countertop" />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

/** A 80 cm Sink Base placed, an integrated top in the colour given, nothing else chosen. */
const startWith = (profile: typeof makoProfile, bindings: RuntimeBindingSet, sinkBase: string, color: string) => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveRuntimeBindings(bindings));
  store.dispatch(syncCabinets([sinkBase]));
  store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
  store.dispatch(setCountertopStyle("integrated"));
  store.dispatch(setActiveCountertopColor(color));
  store.dispatch(setActiveCountertopThickness(""));
  store.dispatch(setActiveBasinStyle(""));
  sceneProducts = {};
  changeMock.mockClear();
};

const changedAttributes = () => changeMock.mock.calls.map(([request]) => request.attributeId);

describe("the Urban Low Height countertop step keeps its thickness and basin on values table 438 allows", () => {
  beforeEach(() => startWith(parsedUlhProfile.profile, ulhRuntimeBindings, "ULH-sink-cabinet-1", "Ardesia TKF"));

  it("chooses the first thickness and basin the table allows an HPL top while none is chosen", () => {
    renderCountertopStep(urbanLowHeight);

    expect(changedAttributes()).toEqual(["Thickness", "sinkType"]);
    expect(changeMock).toHaveBeenCalledWith({ attributeId: "Thickness", value: "0.5", scope: "countertop" });
    // The basin of the composition: the command puts it on every Sink Base.
    expect(changeMock).toHaveBeenCalledWith({ attributeId: "sinkType", value: "Top_HPLPrisma", scope: "basin" });
  });

  it("keeps a thickness and a basin the table allows", () => {
    store.dispatch(setActiveCountertopThickness("4"));
    store.dispatch(setActiveBasinStyle("Top_HPLQuadra"));

    renderCountertopStep(urbanLowHeight);

    expect(changeMock).not.toHaveBeenCalled();
  });

  it("replaces a basin of another material with one of the countertop's", () => {
    store.dispatch(setActiveCountertopThickness("0.5"));
    store.dispatch(setActiveBasinStyle("Top_Porcelain_Cover"));

    renderCountertopStep(urbanLowHeight);

    expect(changeMock).toHaveBeenCalledWith(
      expect.objectContaining({ attributeId: "sinkType", value: "Top_HPLPrisma" }),
    );
    expect(changedAttributes()).toEqual(["sinkType"]);
  });

  it("leaves a vessel countertop without a basin on its empty cutout", () => {
    store.dispatch(setActiveCountertopThickness("0.5"));
    store.dispatch(setCountertopStyle("vessel"));

    renderCountertopStep(urbanLowHeight);

    expect(changeMock).not.toHaveBeenCalled();
  });
});

// Mako and Class stand 52 cm deep, the depth of their countertop tables.
describe("the Mako countertop step keeps its basin on one table 577 allows", () => {
  beforeEach(() => {
    startWith(makoProfile, makoRuntimeBindings, "Mako-sink-cabinet-1", "CALACATTA 259");
    store.dispatch(setSelectedDimensions({ depth: 52 }));
  });

  it("replaces the default glass basin with the one an HPL top takes", () => {
    // VA005 is the Mako default, for its black glass top; table 577 gives an HPL top VA024 only.
    store.dispatch(setActiveBasinStyle("VA005"));

    renderCountertopStep(mako);

    expect(changeMock.mock.calls.map(([request]) => request)).toEqual([
      { attributeId: "sinkType", value: "VA024", scope: "basin" },
    ]);
  });

  it("judges the basin by the Sink Base when a narrower Side Cabinet stands first", async () => {
    // Mako Vanity · 48" 2-Drawer Legs 1: Prebuilt sizes the step by its first cabinet, the 40 cm
    // Side Cabinet; VA024 takes a Sink Base of 60 cm or more, and the Sink Base is 80 cm.
    sceneProducts = {
      "Mako-side-cabinet-1": { ProductType: "Mako-side-cabinet", Width: 40, Depth: 52 },
      "Mako-sink-cabinet-2": { ProductType: "Mako-sink-cabinet", Width: 80, Depth: 52 },
    };
    store.dispatch(syncCabinets(Object.keys(sceneProducts)));
    store.dispatch(setSelectedDimensions({ width: 40, depth: 52 }));
    store.dispatch(setActiveBasinStyle("VA005"));

    renderCountertopStep(mako);

    await waitFor(() =>
      expect(changeMock).toHaveBeenCalledWith({ attributeId: "sinkType", value: "VA024", scope: "basin" }),
    );
  });
});

describe("a countertop field that declares no autoSelect", () => {
  beforeEach(() => {
    startWith(classProfile, classRuntimeBindings, "Class-sink-cabinet-1", "CALACATTA 259");
    store.dispatch(setSelectedDimensions({ depth: 52 }));
  });

  it("leaves the Class basin as it is", () => {
    renderCountertopStep(classCollection);

    expect(changeMock).not.toHaveBeenCalled();
  });
});
