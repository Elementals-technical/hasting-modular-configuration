// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => (fallback.length ? fallback : ["rt-a", "rt-b"]),
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: vi.fn(async (id: string) => ({ ProductType: "Sink-Base", Width: 60, Handle: "handle_pto", id })),
}));

import { store } from "@/app/store";
import {
  finishRestore,
  resetConfiguration,
  setActiveCollectionId,
  setAttributeValue,
  startRestore,
  syncCabinets,
} from "@/entities/configuration";
import {
  reset,
  setCabinetColor,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setHandleGrooveColor,
  setSelectedProductConfig,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import {
  hashConfigurationRequest,
  useBuildConfigurationRequest,
  useSaveCurrentConfiguration,
  type ConfigurationSaveRequest,
} from "../hooks/useSaveCurrentConfiguration";

/**
 * The five save entry points build one order (C08/C12).
 *
 * Player and the buttons under the scene save through `useSaveCurrentConfiguration`, the
 * bottom bar link through `useCurrentConfigurationLink` (the same hook), and both Summary
 * pages call `useBuildConfigurationRequest` directly. Each used to assemble the payload by
 * hand, which is how `Handle`, `CabinetColorMaterial` and `CabinetColorFinish` were lost.
 */

const USH = "urban-standard-height";

/** Every entry point, by the route it saves from. */
const ENTRY_POINTS = [
  ["Player", "/custom/cabinet-builder"],
  ["buttons under the scene", "/custom/countertop"],
  ["custom Summary", "/custom/summary"],
  ["prebuilt Summary", "/prebuilt/summary"],
  ["bottom bar link", "/custom/accessories"],
] as const;

const wrapperOn = (path: string) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </Provider>
  );
  return Wrapper;
};

const buildFrom = async (
  path: string,
  options: Parameters<ReturnType<typeof useBuildConfigurationRequest>>[0] = {},
) => {
  const { result } = renderHook(() => useBuildConfigurationRequest(), { wrapper: wrapperOn(path) });
  return result.current(options);
};

/** `savedAt` differs on every build, so it never takes part in the comparison. */
const withoutTimestamp = ({ configuration, metadata }: ConfigurationSaveRequest) => ({
  configuration,
  metadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "savedAt")),
});

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveCollectionId(USH));
  store.dispatch(syncCabinets(["rt-a", "rt-b"]));
  store.dispatch(setCabinetColor("Castagno chiaro 1C1"));
  store.dispatch(setCabinetColorMaterial("3D"));
  store.dispatch(setCabinetColorFinish("Matte"));
  store.dispatch(setHandleGrooveColor("Carbone 43 MT"));
  store.dispatch(setTowelBarOption("Both"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
  store.dispatch(setAttributeValue({ attributeId: "TestFinish", target: { scope: "global" }, value: "Matte" }));
});

describe("the five save entry points", () => {
  it("build the same order from the same state", async () => {
    const requests = await Promise.all(ENTRY_POINTS.map(([, path]) => buildFrom(path, { path: "/same" })));

    requests.forEach((request) => expect(request).not.toBeNull());
    const hashes = requests.map((request) => hashConfigurationRequest(request!));

    expect(new Set(hashes).size).toBe(1);
  });

  it.each(ENTRY_POINTS)("records where %s saved from, and nothing else differs", async (_name, path) => {
    const fromRoute = await buildFrom(path);
    const reference = await buildFrom("/custom/summary");

    expect(fromRoute?.metadata.path).toBe(path);
    expect(withoutTimestamp(fromRoute!).metadata).toEqual({
      ...withoutTimestamp(reference!).metadata,
      path,
    });
  });

  it("carries the fields the old hand-written payloads dropped", async () => {
    const request = await buildFrom("/custom/summary");

    expect(request?.metadata.uiState).toMatchObject({
      Handle: "handle_urban_topcut",
      CabinetColorMaterial: "3D",
      CabinetColorFinish: "Matte",
      CabinetColor: "Castagno chiaro 1C1",
      HandleGrooveColor: "Carbone 43 MT",
      TowelBarOption: "Both",
    });
    expect(request?.metadata.collectionId).toBe(USH);
    expect(request?.metadata.configuration.values).toMatchObject({ global: { TestFinish: "Matte" } });
  });

  it("saves nothing while a restore is incomplete", async () => {
    store.dispatch(startRestore("13507"));
    store.dispatch(finishRestore({ status: "partial", reason: "partial", message: "half the scene came back" }));

    const { result } = renderHook(() => useSaveCurrentConfiguration(), { wrapper: wrapperOn("/custom/summary") });

    await expect(result.current()).resolves.toEqual({ ok: false, reason: "restore-incomplete" });
  });

  it("saves nothing without an active collection", async () => {
    store.dispatch(setActiveCollectionId(null));

    const { result } = renderHook(() => useSaveCurrentConfiguration(), { wrapper: wrapperOn("/custom/summary") });

    await expect(result.current()).resolves.toEqual({ ok: false, reason: "no-collection" });
  });
});
