import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveProfile, setPlacedCabinetStyle } from "@/entities/product/model/store/slice";
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
