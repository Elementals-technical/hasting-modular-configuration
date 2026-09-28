// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import makoManifestDocument from "../../../../public/collections/mako/manifest.json";
import makoUiDocument from "../../../../public/collections/mako/ui.json";
import ulhManifestDocument from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUiDocument from "../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import {
  getCabinetEntries,
  resetConfiguration,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
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
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");

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
  changeMock.mockClear();
};

const changedAttributes = () => changeMock.mock.calls.map(([request]) => request.attributeId);

describe("the Urban Low Height countertop step keeps its thickness and basin on values table 438 allows", () => {
  beforeEach(() => startWith(parsedUlhProfile.profile, ulhRuntimeBindings, "ULH-sink-cabinet-1", "Ardesia TKF"));

  it("chooses the first thickness and basin the table allows an HPL top while none is chosen", () => {
    renderCountertopStep(urbanLowHeight);

    const [sinkBase] = getCabinetEntries(store.getState());
    expect(changedAttributes()).toEqual(["Thickness", "sinkType"]);
    expect(changeMock).toHaveBeenCalledWith({ attributeId: "Thickness", value: "0.5", scope: "countertop" });
    expect(changeMock).toHaveBeenCalledWith({
      attributeId: "sinkType",
      value: "Top_HPLPrisma",
      scope: "basin",
      sinkBaseId: sinkBase.stableKey,
    });
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

describe("a countertop field that declares no autoSelect", () => {
  beforeEach(() => startWith(makoProfile, makoRuntimeBindings, "Mako-sink-cabinet-1", "CALACATTA 259"));

  it("leaves the Mako basin as it is", () => {
    renderCountertopStep(mako);

    expect(changeMock).not.toHaveBeenCalled();
  });
});
