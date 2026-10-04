// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ReadyCollectionContext } from "@/entities/collection";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { useChangeAttribute } from "../hooks/useChangeAttribute";
import type { ChangeResult } from "../model/types";
import { readyCollectionFixture } from "./readyCollectionFixture";

const matrix = {
  rows: [
    {
      cabinet_type: "Sink-Base",
      widths_cm: "60|80",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "1D|2D",
      handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
      supports_height: "50|53|56",
      handle_pto_forced_height_cm: "1D:50|2D:50",
      handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
      handle_urban_botcut_forced_height_cm: "2D:56",
      handle_urban_botcut_requires_drawers: "2D",
    },
  ],
} as unknown as ProductDatatable;

const renderOnRoute = (path: string, runtime = createTestRuntimePort()) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={readyCollectionFixture}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>
  );

  return { runtime, ...renderHook(() => useChangeAttribute({ runtime: runtime.port }), { wrapper }) };
};

describe("useChangeAttribute", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, ushProfile)));
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
    store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
  });

  it("previews on the page, then applies once on confirm with the route's flow", async () => {
    const { result, runtime } = renderOnRoute("/custom/cabinet-builder");

    let asked: ChangeResult | undefined;
    await act(async () => {
      asked = await result.current.change({
        attributeId: "Handle",
        value: "handle_pto",
        scope: "cabinet",
        cabinetId: "cab-1",
      });
    });

    expect(asked?.status).toBe("confirmation-required");
    expect(runtime.calls).toHaveLength(0);
    if (asked?.status !== "confirmation-required") return;

    const preview = asked.preview;
    let confirmed: ChangeResult | undefined;
    await act(async () => {
      confirmed = await result.current.confirm(preview);
    });

    expect(confirmed?.status).toBe("applied");
    expect(runtime.calls).toHaveLength(1);
    expect(runtime.contexts[0]).toMatchObject({ flow: "custom", collectionId: "urban-standard-height" });
  });

  it("reads the prebuilt flow from a prebuilt route", async () => {
    const { result, runtime } = renderOnRoute("/prebuilt/color");

    await act(async () => {
      await result.current.change({ attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: "cab-1" });
    });

    expect(runtime.contexts[0]?.flow).toBe("prebuilt");
  });
});
