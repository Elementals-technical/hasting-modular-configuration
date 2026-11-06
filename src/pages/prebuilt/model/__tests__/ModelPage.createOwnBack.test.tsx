// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { parseProductProfile, ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import {
  resetConfiguration,
  setActiveCollectionId,
  setActivePrebuiltPresetId,
  setActiveRuntimeBindings,
} from "@/entities/configuration";
import type { ConfigurationSidePanelPort } from "@/entities/configuration";
import { clearHistory } from "@/entities/history/model/store/slice";
import { getProductsPresets } from "@/entities/product/model/store/selectors";
import { addProductPreset, reset, setActiveProfile } from "@/entities/product/model/store/slice";
import type { UseChangeAttributeOptions } from "@/features/configurationCommands/hooks/useChangeAttribute";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import {
  createTestCompositionPort,
  createTestRuntimePort,
  createTestSidePanelPort,
} from "@/features/playCanvasAdapter";
import type { TestCompositionPort } from "@/features/playCanvasAdapter";

import classManifestDocument from "../../../../../public/collections/class/manifest.json";
import classPresetsDocument from "../../../../../public/collections/class/presets.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import classUiDocument from "../../../../../public/collections/class/ui.json";
import { ModelPage } from "../ModelPage";

/**
 * "Create Your Own" leaves the model the Model step showed in that step's history entry, so the
 * browser's Back from Custom places it again, even when the step was reached by a step arrow, whose
 * URL names no model.
 */

const mocks = vi.hoisted(() => ({
  ports: null as UseChangeAttributeOptions | null,
  sidePanelPort: null as ConfigurationSidePanelPort | null,
  /** The products the scene holds, as the page reads them back. */
  sceneOrder: (): string[] => [],
}));

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => (mocks.sceneOrder().length ? mocks.sceneOrder() : fallback),
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => null) }));
vi.mock("@/features/playCanvasAdapter/lib/createSidePanelPort", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/playCanvasAdapter/lib/createSidePanelPort")>();
  return { createSidePanelPort: () => mocks.sidePanelPort ?? actual.createSidePanelPort() };
});
vi.mock("@/features/configurationCommands/hooks/useChangeAttribute", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands/hooks/useChangeAttribute")>();
  return {
    useChangeAttribute: (options?: Parameters<typeof actual.useChangeAttribute>[0]) =>
      actual.useChangeAttribute({ ...options, ...mocks.ports }),
  };
});

const parsedProfile = parseProductProfile(classProfileDocument);
if (!parsedProfile.ok) throw new Error("Class profile must parse");

const configuratorGroups = configuratorSchema.parse(configurator9).availableOptions;
const base = buildReadyCollection("class", classManifestDocument, classUiDocument, classPresetsDocument);
const collection = {
  ...base,
  catalog: {
    ...base.catalog,
    runtimeBindings: classRuntimeBindings,
    configurator: {
      groups: configuratorGroups,
      groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
    },
    countertops: parseCountertopMatrix(countertopDatatableSchema.parse(datatable578)),
  },
};

const MODEL = classPresetsDocument.find(({ id }) => id === 9);
if (!MODEL) throw new Error("Class must hold model 9");

const LocationProbe = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${pathname}${search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
};

let composition: TestCompositionPort = createTestCompositionPort();
let sidePanels = createTestSidePanelPort();

/** The Model step opened as `modelUrl`, one entry after a page of its own. */
const renderModelStep = (modelUrl: string) => {
  const router = createMemoryRouter(
    [
      { path: "/start", element: <LocationProbe /> },
      {
        path: "/prebuilt/model",
        element: (
          <>
            <ModelPage />
            <LocationProbe />
          </>
        ),
      },
      { path: "/custom", element: <LocationProbe /> },
    ],
    { initialEntries: ["/start?collectionId=class", modelUrl], initialIndex: 1 },
  );
  render(
    <Provider store={store}>
      <ReadyCollectionContext.Provider value={collection}>
        <RouterProvider router={router} />
      </ReadyCollectionContext.Provider>
    </Provider>,
  );
};

const location = () => screen.getByTestId("location").textContent;

const createYourOwn = async () => {
  // The mode switcher names Custom the same; the card is the one beside the model cards.
  const card = document.querySelector('[class*="createModel"] [class*="selectArea"]');
  if (!card) throw new Error("The Create Your Own card is not shown");
  fireEvent.click(card);
  await waitFor(() => expect(location()).toMatch(/^\/custom/));
};

const browserBack = () => fireEvent.click(screen.getByRole("button", { name: "Browser back" }));

/** Model 9 is on the scene and in the state, as Next to another step and its arrow back leave it. */
const holdModel = () => {
  composition = createTestCompositionPort(["Class-sink-cabinet-placed"]);
  mocks.ports = { composition: composition.port, runtime: createTestRuntimePort().port, sidePanels: sidePanels.port };
  mocks.sceneOrder = () => composition.order();
  store.dispatch(addProductPreset(MODEL.presetProducts));
  store.dispatch(setActivePrebuiltPresetId(MODEL.id));
  sessionStorage.setItem("prebuiltModelInitialized", "1");
};

describe("Back from Create Your Own", () => {
  beforeEach(() => {
    sessionStorage.clear();
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(clearHistory());
    store.dispatch(setActiveProfile(parsedProfile.profile));
    store.dispatch(setActiveCollectionId("class"));
    store.dispatch(setActiveRuntimeBindings(classRuntimeBindings));
    sidePanels = createTestSidePanelPort();
    mocks.sidePanelPort = sidePanels.port;
  });

  afterEach(() => {
    cleanup();
    mocks.ports = null;
    mocks.sidePanelPort = null;
    mocks.sceneOrder = () => [];
  });

  it("writes the shown model into the Model entry reached without one, and adds no entry", async () => {
    holdModel();
    renderModelStep("/prebuilt/model?collectionId=class");

    await createYourOwn();

    expect(location()).toBe("/custom?collectionId=class");
    // The model was cleared for Custom, not placed again on the way there.
    expect(composition.calls.map(({ op }) => op)).toEqual(["clear"]);

    browserBack();
    await waitFor(() => expect(location()).toBe("/prebuilt/model?collectionId=class&preset=9"));

    browserBack();
    await waitFor(() => expect(location()).toBe("/start?collectionId=class"));
  });

  it("does not place the model again on the way to Custom when only the state's products name it", async () => {
    holdModel();
    store.dispatch(setActivePrebuiltPresetId(null));
    renderModelStep("/prebuilt/model?collectionId=class");

    await createYourOwn();

    expect(composition.calls.map(({ op }) => op)).toEqual(["clear"]);
    expect(composition.order()).toEqual([]);

    browserBack();
    await waitFor(() => expect(location()).toBe("/prebuilt/model?collectionId=class&preset=9"));
  });

  it("opens Custom without the model the Model URL names", async () => {
    holdModel();
    renderModelStep("/prebuilt/model?collectionId=class&preset=9");

    await createYourOwn();

    expect(location()).toBe("/custom?collectionId=class");

    browserBack();
    await waitFor(() => expect(location()).toBe("/prebuilt/model?collectionId=class&preset=9"));
  });

  it("leaves the URL as it is when no model card is highlighted", async () => {
    holdModel();
    // A composition no model equals, the user's own edit of the model.
    store.dispatch(addProductPreset([{ ...MODEL.presetProducts[0], Width: 100 }]));
    store.dispatch(setActivePrebuiltPresetId(null));
    renderModelStep("/prebuilt/model?collectionId=class");

    await createYourOwn();
    browserBack();

    await waitFor(() => expect(location()).toBe("/prebuilt/model?collectionId=class"));
  });

  it("places the model again on Back, over the cabinets Custom left on the scene", async () => {
    holdModel();
    renderModelStep("/prebuilt/model?collectionId=class");

    await createYourOwn();
    expect(getProductsPresets(store.getState())).toEqual([]);
    expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBeNull();
    // A cabinet the user added in Custom.
    await composition.port.add({ productType: "Sink-Base", config: {} }, { kind: "end" });

    browserBack();

    await waitFor(() => expect(store.getState().rootStateUI.configuration.activePrebuiltPresetId).toBe(MODEL.id));
    expect(composition.calls.map(({ op }) => op)).toEqual(["clear", "add", "replace"]);
    expect(getProductsPresets(store.getState())).toHaveLength(MODEL.presetProducts.length);
    expect(getProductsPresets(store.getState())[0]).toMatchObject({ name: "Sink-Base", Width: 120 });
  });
});
