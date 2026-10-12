import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import { configuratorSchema, parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import {
  createPlayCanvasRuntimePort,
  type SceneBridge,
} from "@/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort";

import profileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import bindingsDocument from "../../../../public/collections/urban-freestanding/runtime-bindings.json";
import { changeAttribute } from "../lib/changeAttribute";

/**
 * Urban Freestanding flutes Lacquer Matte cabinets only. The UF scene products have no fluting rule,
 * so the pattern is recorded for the SKU and never sent; a colour of another material clears it.
 */

const profileResult = parseProductProfile(profileDocument);
const bindingsResult = parseRuntimeBindings(bindingsDocument);
if (!profileResult.ok || !bindingsResult.ok) throw new Error("Urban Freestanding data failed validation");
const profile = profileResult.profile;
const bindings = bindingsResult.bindings;
const { availableOptions } = configuratorSchema.parse(configurator11);
const configurator = {
  groups: availableOptions,
  groupsByName: Object.fromEntries(availableOptions.map((group) => [group.proxyName, group])),
};

const runtimeIds = ["UF-sink-cabinet-a1", "UF-side-cabinet-b2"];
const apply = vi.fn<SceneBridge["apply"]>(async () => ({ status: "applied", updatedIds: runtimeIds }));
const deps = () => ({
  getState: () => store.getState(),
  dispatch: store.dispatch,
  runtime: createPlayCanvasRuntimePort({ getBindings: () => bindings, scene: { isReady: () => true, apply } }),
  flow: "custom" as const,
  configurator,
});
const first = () => getCabinetEntries(store.getState())[0].stableKey;
const fluting = () =>
  getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: first() });
const changeColor = (value: string) => changeAttribute({ attributeId: "CabinetColor", scope: "global", value }, deps());
const changeFluting = (value: string) =>
  changeAttribute({ attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId: first(), value }, deps());

beforeEach(() => {
  apply.mockClear();
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId("urban-freestanding"));
  store.dispatch(setActiveRuntimeBindings(bindings));
  store.dispatch(syncCabinets(runtimeIds));
});

describe("Urban Freestanding drawer panel fluting", () => {
  it("is refused on the default brushed steel and recorded on Lacquer Matte without reaching the scene", async () => {
    expect((await changeColor("Metal acciaio 2MA")).status).toBe("applied");
    expect(await changeFluting("FlutingVerticalA")).toMatchObject({
      status: "blocked",
      reasonCode: "fluting.notAvailable",
    });

    expect((await changeColor("Bianco 0B MT")).status).toBe("applied");
    expect((await changeFluting("FlutingVerticalA")).status).toBe("applied");
    expect(fluting()).toBe("FlutingVerticalA");
    expect(apply.mock.calls.some(([, patch]) => "DrawerPanelFluting" in patch)).toBe(false);
  });

  it("keeps the pattern on another Lacquer Matte and clears it on a colour of another material", async () => {
    await changeColor("Bianco 0B MT");
    await changeFluting("FlutingHorizontalB");

    expect((await changeColor("Carbone 43 MT")).status).toBe("applied");
    expect(fluting()).toBe("FlutingHorizontalB");

    expect((await changeColor("Metal acciaio 2MA")).status).toBe("applied");
    expect(fluting()).toBe("None");
  });
});
