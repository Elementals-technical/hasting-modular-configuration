import { beforeEach, describe, expect, it } from "vitest";

import makoCabinetTable from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setPlacedCabinetStyle,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { changeAttribute } from "../lib/changeAttribute";
import { REASON_MISSING_PRODUCT_DATA } from "../lib/undeterminedGate";
import type { AttributeChange } from "../model/types";

/**
 * CONTRACTS §8: a change the product has not decided is blocked as "undetermined" before
 * anything is planned. Mako declares one: Leg Color on a cabinet with one drawer, which has no
 * legs (Q-MAKO-002). The cases are profile data; the gate knows no Mako attribute.
 */

const RUNTIME_IDS = ["Sink-Base-aaa111", "Sink-Base-bbb222"];

const open = (collectionId: string, profile: ProductProfile) => {
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId(collectionId));
  store.dispatch(syncCabinets(RUNTIME_IDS));
  return getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
};

const run = (change: AttributeChange) => {
  const runtime = createTestRuntimePort();
  const result = changeAttribute(change, {
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    runtime: runtime.port,
    flow: "custom",
  });
  return { runtime, result };
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

describe("changes the product has not decided", () => {
  it("block Leg Color on a one-drawer Mako cabinet, change nothing and send nothing to the scene", async () => {
    const [oneDrawer, twoDrawers] = open("mako", makoProfile);
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[0], value: "1D" }));
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[1], value: "2D" }));

    const blocked = run({ attributeId: "LegColor", value: "Silver", scope: "cabinet", cabinetId: oneDrawer });
    expect(await blocked.result).toMatchObject({
      status: "blocked",
      attributeId: "LegColor",
      reasonCode: REASON_MISSING_PRODUCT_DATA,
      compatibility: "undetermined",
    });
    expect(blocked.runtime.calls).toEqual([]);
    expect(getAttributeValue(store.getState(), "LegColor", { scope: "cabinet", cabinetId: oneDrawer })).toBeUndefined();

    const applied = run({ attributeId: "LegColor", value: "Silver", scope: "cabinet", cabinetId: twoDrawers });
    expect((await applied.result).status).toBe("applied");
  });

  it("read the cabinet's drawers the command recorded as well as the placed style", async () => {
    const [cabinet] = open("mako", makoProfile);
    store.dispatch(setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: cabinet }, value: "1" }));

    const { result } = run({ attributeId: "LegColor", value: "Gold", scope: "cabinet", cabinetId: cabinet });
    expect(await result).toMatchObject({ status: "blocked", compatibility: "undetermined" });
  });

  it("let the legs be switched off on a one-drawer cabinet, since clearing needs no product data", async () => {
    const [oneDrawer] = open("mako", makoProfile);
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[0], value: "1D" }));

    const { result } = run({ attributeId: "LegColor", value: "", scope: "cabinet", cabinetId: oneDrawer });
    expect((await result).status).toBe("applied");
    expect(getAttributeValue(store.getState(), "LegColor", { scope: "cabinet", cabinetId: oneDrawer })).toBe("");
  });

  it("block the legs in the cabinet colour on a one-drawer cabinet, as any other leg colour", async () => {
    const [oneDrawer] = open("mako", makoProfile);
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[0], value: "1D" }));

    const { runtime, result } = run({ attributeId: "LegColor", value: "None", scope: "cabinet", cabinetId: oneDrawer });
    expect(await result).toMatchObject({ status: "blocked", compatibility: "undetermined" });
    expect(runtime.calls).toEqual([]);
  });

  it("let a change through when the cabinet's drawers are unknown or the collection declares no such case", async () => {
    const [cabinet] = open("mako", makoProfile);
    expect((await run({ attributeId: "LegColor", value: "Gold", scope: "cabinet", cabinetId: cabinet }).result).status).toBe(
      "applied",
    );

    const [ushCabinet] = open("urban-standard-height", ushProfile);
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[0], value: "1D" }));
    const ush = await run({ attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: ushCabinet }).result;
    expect(ush).not.toMatchObject({ reasonCode: REASON_MISSING_PRODUCT_DATA });
  });

  it("name the rule in the reason the profile gives", async () => {
    const [cabinet] = open("mako", makoProfile);
    store.dispatch(setPlacedCabinetStyle({ id: RUNTIME_IDS[0], value: "1D" }));

    const result = await run({ attributeId: "LegColor", value: "Gold", scope: "cabinet", cabinetId: cabinet }).result;
    expect(result).toMatchObject({ reason: makoProfile.messages[REASON_MISSING_PRODUCT_DATA] });
  });
});

describe("a Mako model on legs switched to one drawer", () => {
  const PLACED = ["Mako-sink-cabinet-a", "Mako-side-cabinet-b"];
  let cabinets: string[] = [];
  const legColorAt = (cabinetId: string) =>
    getAttributeValue(store.getState(), "LegColor", { scope: "cabinet", cabinetId });
  const sentLegColors = (runtime: ReturnType<typeof createTestRuntimePort>) =>
    runtime.calls.flat().filter(({ attributeId }) => attributeId === "LegColor");

  beforeEach(() => {
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(setActiveCollectionId("mako"));
    store.dispatch(setActiveRuntimeBindings(makoRuntimeBindings));
    store.dispatch(
      setCabinetCatalog(
        buildCabinetCatalogFromMatrix(makoCabinetTable as ProductDatatable, makoProfile, makoRuntimeBindings),
      ),
    );
    store.dispatch(setActiveCabinetType("Sink-Base"));
    store.dispatch(setSelectedProductConfig({ Drawers: "2", Handle: "G57" }));
    store.dispatch(syncCabinets(PLACED));
    PLACED.forEach((id) => store.dispatch(setPlacedCabinetStyle({ id, value: "2D" })));
    cabinets = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
    // The model's legs, recorded at every cabinet as placing a Legs model records them.
    cabinets.forEach((cabinetId) =>
      store.dispatch(
        setAttributeValue({
          attributeId: "LegColor",
          target: { scope: "cabinet", cabinetId },
          value: "Antracite 400 MT",
        }),
      ),
    );
  });

  it("loses its legs with the drawers, at every cabinet, and the scene hears it once", async () => {
    const { runtime, result } = run({ attributeId: "Drawers", value: "1", scope: "cabinet", cabinetId: cabinets[0] });

    expect((await result).status).toBe("applied");
    expect(sentLegColors(runtime)).toEqual([
      expect.objectContaining({ value: "", origin: "dependency", reasonCode: REASON_MISSING_PRODUCT_DATA }),
    ]);
    // Pricing reads the composition's leg colour: none, so the order has no legs line.
    expect(cabinets.map(legColorAt)).toEqual(["", ""]);
  });

  it("does not get its legs back with two drawers again", async () => {
    await run({ attributeId: "Drawers", value: "1", scope: "cabinet", cabinetId: cabinets[0] }).result;
    PLACED.forEach((id) => store.dispatch(setPlacedCabinetStyle({ id, value: "1D" })));

    const { runtime, result } = run({ attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: cabinets[0] });

    expect((await result).status).toBe("applied");
    expect(sentLegColors(runtime)).toEqual([]);
    expect(cabinets.map(legColorAt)).toEqual(["", ""]);
  });
});
