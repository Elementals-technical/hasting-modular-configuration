// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import tricotManifest from "../../../../../public/collections/tricot/manifest.json";
import tricotUiDocument from "../../../../../public/collections/tricot/ui.json";
import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import cabinetTable592 from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import { tricotMatrixProfile, tricotTestBindings } from "@/entities/collection/__tests__/tricotFixtures";
import {
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { recordComposition, replaceCollectionData, reset } from "@/entities/product/model/store/slice";
import { recordValues } from "@/features/configurationCommands";

import { useVesselCountertop } from "../useVesselCountertop";

/**
 * An integrated Tricot countertop does not take a 60 cm Sink Base with an inner drawer (table 592:
 * `60:1DWID`). Resizing a placed one to 60 cm in the scene's menu asks for the vessel countertop first.
 */

const catalog = buildCabinetCatalogFromMatrix(cabinetTable592, tricotMatrixProfile, tricotTestBindings);
const collection = buildReadyCollection("tricot", tricotManifest, tricotUiDocument);
const SINK_BASE = tricotTestBindings.productTypes["Sink-Base"] + "-1";

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <MemoryRouter initialEntries={["/custom/cabinet-builder?collectionId=tricot"]}>
      <ReadyCollectionContext.Provider value={collection}>{children}</ReadyCollectionContext.Provider>
    </MemoryRouter>
  </Provider>
);

/** An 80 cm Sink Base with `drawers` stands on the countertop. */
const placeSinkBase = (drawers: string) => {
  store.dispatch(recordComposition({ productIds: [SINK_BASE], placedCabinetStyles: { [SINK_BASE]: drawers } }));
  store.dispatch(syncCabinets([SINK_BASE]));
  store.dispatch(
    recordSceneState({
      order: [SINK_BASE],
      cabinets: [{ runtimeId: SINK_BASE, dimensions: { width: 80, height: 40, depth: 52 } }],
    }),
  );
  store.dispatch(
    setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: drawers }),
  );
};

const resizeRequest = (widthCm: number) =>
  renderHook(() => useVesselCountertop(), { wrapper }).result.current.resizeRequest(SINK_BASE, widthCm);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(replaceCollectionData({ profile: tricotMatrixProfile, cabinetCatalog: catalog }));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
});

afterEach(cleanup);

describe("resizing a placed Tricot Sink Base on an integrated countertop", () => {
  it("asks for the vessel countertop before 60 cm with an inner drawer", () => {
    placeSinkBase("1+inner");

    expect(resizeRequest(60)).toEqual({ cabinetType: "Sink-Base", drawers: "1+inner", widthCm: 60 });
  });

  it("takes the other widths, and 60 cm with one drawer, at once", () => {
    placeSinkBase("1+inner");
    expect(resizeRequest(100)).toBeNull();

    placeSinkBase("1");
    expect(resizeRequest(60)).toBeNull();
  });

  it("takes 60 cm at once on a vessel countertop", () => {
    placeSinkBase("1+inner");
    recordValues({ CountertopStyle: "vessel" }, { getState: store.getState, dispatch: store.dispatch, flow: "custom" });

    expect(resizeRequest(60)).toBeNull();
  });
});
