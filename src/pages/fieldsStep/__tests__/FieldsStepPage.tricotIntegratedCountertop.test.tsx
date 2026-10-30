// @vitest-environment jsdom

import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import tricotManifestDocument from "../../../../public/collections/tricot/manifest.json";
import tricotUiDocument from "../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable592 from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import {
  tricotConfigurator,
  tricotMatrixProfile,
  tricotTestBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import {
  getAttributeValue,
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { recordComposition, replaceCollectionData, reset } from "@/entities/product/model/store/slice";
import { ReasonTextProvider } from "@/features/collectionCustomization";
import { recordValues } from "@/features/configurationCommands";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";

import { FieldsStepPage } from "../FieldsStepPage";

/**
 * An integrated Tricot countertop does not take a 60 cm Sink Base with an inner drawer (table 592:
 * `60:1DWID`). Over one, Integrated is drawn restricted: chosen, it asks first, and approved, the Sink
 * Base takes one drawer and the countertop is integrated, as one step back.
 */

const scene = vi.hoisted(() => ({
  runtime: null as TestRuntimePort | null,
  // Each undo step the page takes runs its change; the step's own rules are useHistoryStep's tests.
  runStep: vi.fn(<T,>(change: () => Promise<T>) => change()),
}));

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");
vi.mock("@/entities/history/lib/useHistoryStep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/history/lib/useHistoryStep")>()),
  useHistoryStep: () => ({ run: scene.runStep }),
}));
vi.mock("@/features/playCanvasAdapter", async (importOriginal) => {
  const adapter = await importOriginal<typeof import("@/features/playCanvasAdapter")>();
  return {
    ...adapter,
    createPlayCanvasRuntimePort: () => (scene.runtime ??= adapter.createTestRuntimePort()).port,
  };
});

const catalog = buildCabinetCatalogFromMatrix(cabinetTable592, tricotMatrixProfile, tricotTestBindings);
const collection = buildReadyCollection("tricot", tricotManifestDocument, tricotUiDocument);

const SINK_BASE = tricotTestBindings.productTypes["Sink-Base"] + "-1";
const PROMPT = "Update Design?";
const REASON =
  "Your design will be updated: a Sink Base with 1 Drawer + Inner Drawer is not compatible with an Integrated countertop and will switch to 1 Drawer.";

const product = () => store.getState().rootStateUI.product;
const drawersOfSinkBase = () =>
  getAttributeValue(store.getState(), "Drawers", { scope: "cabinet", cabinetId: "cab-1" });

/** A 60 cm Sink Base with `drawers` stands under a vessel countertop. */
const placeSinkBase = (drawers: string) => {
  store.dispatch(recordComposition({ productIds: [SINK_BASE], placedCabinetStyles: { [SINK_BASE]: drawers } }));
  store.dispatch(syncCabinets([SINK_BASE]));
  store.dispatch(
    recordSceneState({
      order: [SINK_BASE],
      cabinets: [{ runtimeId: SINK_BASE, dimensions: { width: 60, height: 40, depth: 52 } }],
    }),
  );
  store.dispatch(
    setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: drawers }),
  );
  recordValues(
    { CountertopColor: "Matte White", CountertopStyle: "vessel", sinkType: "None" },
    { getState: store.getState, dispatch: store.dispatch, flow: "custom", configurator: tricotConfigurator },
  );
};

const renderCountertopStep = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/custom/countertop?collectionId=tricot"]}>
        <ReadyCollectionContext.Provider
          value={{
            ...collection,
            catalog: {
              ...collection.catalog,
              configurator: tricotConfigurator,
              countertops: tricotMatrixProfile.countertopRules,
            },
          }}
        >
          {/* The hints read the collection's own texts, as in the app. */}
          <ReasonTextProvider>
            <FieldsStepPage stepId="countertop" />
          </ReasonTextProvider>
        </ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

const integratedCard = () =>
  within(screen.getByRole("region", { name: "Countertop Style" })).getByRole("button", { name: "Integrated" });
/** A style that changes more than the countertop is drawn as restricted and asks first. */
const isRestricted = () =>
  Boolean(integratedCard().closest('[class*="productOption"]')?.className.includes("restrictedOption"));
/** Every change the scene was sent, in order. */
const sceneChanges = () => (scene.runtime?.calls ?? []).flat();

beforeEach(() => {
  scene.runtime = null;
  scene.runStep.mockClear();

  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: tricotMatrixProfile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
});

afterEach(cleanup);

describe("Tricot Integrated countertop over a 60 cm Sink Base with an inner drawer", () => {
  it("is drawn restricted, says why, and asks first", async () => {
    placeSinkBase("1+inner");
    renderCountertopStep();

    expect(isRestricted()).toBe(true);
    fireEvent.mouseEnter(integratedCard().closest('[class*="productOption"]') as HTMLElement);
    expect(screen.getByText(REASON)).toBeTruthy();

    fireEvent.click(integratedCard());

    await screen.findByText(PROMPT);
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
    expect(scene.runtime?.calls ?? []).toEqual([]);
    expect(product().productOptions.CountertopStyle).toBe("vessel");
  });

  it("takes the Sink Base to one drawer and the countertop to integrated once approved, as one step", async () => {
    placeSinkBase("1+inner");
    renderCountertopStep();

    fireEvent.click(integratedCard());
    await screen.findByText(PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(product().productOptions.CountertopStyle).toBe("integrated"));
    expect(drawersOfSinkBase()).toBe("1");
    expect(product().placedCabinetStyles).toEqual({ [SINK_BASE]: "1" });
    expect(sceneChanges()).toContainEqual(expect.objectContaining({ attributeId: "Drawers", value: "1" }));
    expect(scene.runStep).toHaveBeenCalledTimes(1);
  });

  it("changes nothing when cancelled", async () => {
    placeSinkBase("1+inner");
    renderCountertopStep();

    fireEvent.click(integratedCard());
    await screen.findByText(PROMPT);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(PROMPT)).toBeNull());
    expect(product().productOptions.CountertopStyle).toBe("vessel");
    expect(drawersOfSinkBase()).toBe("1+inner");
    expect(scene.runtime?.calls ?? []).toEqual([]);
  });

  it("is chosen at once over a 60 cm Sink Base with one drawer", async () => {
    placeSinkBase("1");
    renderCountertopStep();

    expect(isRestricted()).toBe(false);
    fireEvent.click(integratedCard());

    await waitFor(() => expect(product().productOptions.CountertopStyle).toBe("integrated"));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(drawersOfSinkBase()).toBe("1");
  });
});
