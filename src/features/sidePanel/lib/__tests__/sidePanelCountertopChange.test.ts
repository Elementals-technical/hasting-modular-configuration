import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

const sceneMocks = vi.hoisted(() => ({
  applySceneConfig: vi.fn<(selector: SceneSelector, patch: Record<string, unknown>) => Promise<SceneCallResult>>(
    async () => ({ status: "applied", updatedIds: null }),
  ),
}));

vi.mock("@/utils/functions/playcanvas/sceneBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/functions/playcanvas/sceneBridge")>()),
  isSceneReady: () => true,
  applySceneConfig: sceneMocks.applySceneConfig,
}));

import lameProfileDocument from "../../../../../public/collections/lame/product-profile.json";
import ufProfileDocument from "../../../../../public/collections/urban-freestanding/product-profile.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import { store } from "@/app/store";
import { parseProductProfile, type ProductProfile } from "@/entities/collection";
import { tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setCountertopColorSku,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSidePanelsOption,
  setSidePanelSideStatus,
} from "@/entities/product/model/store/slice";

import { getSidePanelLeftStatus, getSidePanelRightStatus, getSidePanelsOption } from "../../model/selectors";

/**
 * The side panel listener in the store the app runs. A countertop colour takes the panels away only
 * through the Syntesi rule. A prebuilt model has no selected cabinet until something selects one, so the
 * availability rule has no cabinet to judge, and that must not read as "panels are forbidden" (T-7).
 */

const parsedProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("A packaged profile failed validation");
  return result.profile;
};

const ulhProfile = parsedProfile(ulhProfileDocument);

const KEPT = { panels: "NoG", left: "active", right: "active" };
const REMOVED = { panels: "None", left: "auto-removed", right: "auto-removed" };

const startWith = (profile: ProductProfile) => {
  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: null }));
};

const selectSinkBase = () => {
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Height: 40 }));
  store.dispatch(setSelectedDimensions({ height: 40 }));
};

const placePanels = () => {
  store.dispatch(setSidePanelsOption("NoG"));
  store.dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
  store.dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));
};

/** The listener's effect is asynchronous and the scene is a resolved mock: it has settled once the queue has run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const changeCountertopColor = async (sku: string) => {
  store.dispatch(setCountertopColorSku(sku));
  await settle();
};

const recordedPanels = () => {
  const state = store.getState();
  return {
    panels: getSidePanelsOption(state),
    left: getSidePanelLeftStatus(state),
    right: getSidePanelRightStatus(state),
  };
};

/** The panels the scene was sent, one [panel, side] pair per call. */
const sentPanels = () =>
  sceneMocks.applySceneConfig.mock.calls.map(([, patch]) => [patch.SidePanel, patch.SidePanelSide]);

describe("side panels when the countertop colour changes", () => {
  beforeEach(() => {
    sceneMocks.applySceneConfig.mockClear();
    store.dispatch(reset());
  });

  it.each([
    ["Tricot", tricotProfile],
    ["Lame", parsedProfile(lameProfileDocument)],
    ["Urban Low Height", ulhProfile],
    ["Urban Freestanding", parsedProfile(ufProfileDocument)],
    ["Urban Standard Height", ushProfile],
  ])("keeps the panels of a %s model while no cabinet is selected", async (_, profile) => {
    startWith(profile);
    placePanels();

    await changeCountertopColor("SSTL");

    expect(recordedPanels()).toEqual(KEPT);
    expect(sentPanels()).toEqual([]);
  });

  it("keeps the panels while a cabinet that takes none is selected", async () => {
    startWith(ulhProfile);
    store.dispatch(setActiveCabinetType("Open-Shelf"));
    placePanels();

    await changeCountertopColor("SSTL");

    expect(recordedPanels()).toEqual(KEPT);
    expect(sentPanels()).toEqual([]);
  });

  it("keeps the panels while a cabinet that takes them is selected", async () => {
    startWith(tricotProfile);
    selectSinkBase();
    placePanels();

    await changeCountertopColor("SSTL");

    expect(recordedPanels()).toEqual(KEPT);
    expect(sentPanels()).toEqual([]);
  });

  it.each([
    ["no cabinet", () => {}],
    ["a Sink Base", selectSinkBase],
  ])("takes the panels away on a Syntesi countertop with %s selected", async (_, select) => {
    startWith(ushProfile);
    select();
    placePanels();

    await changeCountertopColor("SSSYN");

    expect(recordedPanels()).toEqual(REMOVED);
    expect(sentPanels()).toEqual([
      ["None", "left"],
      ["None", "right"],
    ]);
  });
});

describe("side panels when the selected cabinet changes", () => {
  beforeEach(() => {
    sceneMocks.applySceneConfig.mockClear();
    store.dispatch(reset());
  });

  it("still takes the panels away at a height the collection has none for", async () => {
    startWith(tricotProfile);
    selectSinkBase();
    placePanels();

    store.dispatch(setSelectedDimensions({ height: 52 }));
    await settle();

    expect(recordedPanels()).toEqual(REMOVED);
  });
});
