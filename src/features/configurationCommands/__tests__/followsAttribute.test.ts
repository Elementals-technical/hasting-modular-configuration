import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import makoCabinetTable from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
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
import { evaluateChange } from "../lib/evaluateChange";
import type { AttributeChange } from "../model/types";

/**
 * Mako's legs follow the handle colour (`followsAttribute` in the profile): the command reads where the legs are
 * held and whether the new colour is offered to them from state, and plans them in the handle colour's set.
 */

const PLACED = ["Mako-sink-cabinet-a", "Mako-side-cabinet-b"];
const makoGroups = configurator9.availableOptions as unknown as ConfiguratorAvailableOption[];
const configurator: ConfiguratorGroupCatalog = {
  groups: makoGroups,
  groupsByName: Object.fromEntries(makoGroups.map((group) => [group.proxyName, group])),
};

let cabinets: string[] = [];

const record = (attributeId: string, cabinetId: string, value: string) =>
  store.dispatch(setAttributeValue({ attributeId, target: { scope: "cabinet", cabinetId }, value }));

const valueAt = (attributeId: string, cabinetId: string) =>
  getAttributeValue(store.getState(), attributeId, { scope: "cabinet", cabinetId });

const handleColorTo = (value: string): AttributeChange => ({
  attributeId: "HandleColor",
  value,
  scope: "cabinet",
  cabinetId: cabinets[0],
});

const plannedLegs = (change: AttributeChange) => {
  const evaluation = evaluateChange(change, store.getState(), configurator);
  if (evaluation.kind !== "planned") throw new Error(`not planned: ${evaluation.kind}`);
  return evaluation.plan.filter(({ attributeId }) => attributeId === "LegColor");
};

/** A two-drawer composition on legs in the handle colour, unless the drawers say otherwise. */
const open = (
  drawers: readonly string[] = ["2D", "2D"],
  legColors: readonly string[] = ["Antracite 400 MT", "Antracite 400 MT"],
) => {
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
  PLACED.forEach((id, index) => store.dispatch(setPlacedCabinetStyle({ id, value: drawers[index] })));
  cabinets = getCabinetEntries(store.getState()).map(({ stableKey }) => stableKey);
  cabinets.forEach((cabinetId, index) => {
    record("HandleColor", cabinetId, "Antracite 400 MT");
    record("LegColor", cabinetId, legColors[index]);
  });
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

describe("legs that follow the handle colour", () => {
  it("take the new handle colour at every cabinet, and the scene hears it once", async () => {
    open();
    const runtime = createTestRuntimePort();

    const result = await changeAttribute(handleColorTo("Gold"), {
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      runtime: runtime.port,
      flow: "custom",
      configurator,
    });

    expect(result.status).toBe("applied");
    expect(runtime.calls.flat().filter(({ attributeId }) => attributeId === "LegColor")).toEqual([
      expect.objectContaining({ value: "Gold", origin: "dependency" }),
    ]);
    expect(cabinets.map((cabinetId) => valueAt("LegColor", cabinetId))).toEqual(["Gold", "Gold"]);
  });

  it("keep a colour of their own, and stay off when switched off", () => {
    open(["2D", "2D"], ["Silver", "Silver"]);
    expect(plannedLegs(handleColorTo("Gold"))).toEqual([]);

    open(["2D", "2D"], ["", ""]);
    expect(plannedLegs(handleColorTo("Gold"))).toEqual([]);
  });

  it("are read past a first cabinet with one drawer, which has none decided", () => {
    open(["1D", "2D"], ["", "Antracite 400 MT"]);

    expect(plannedLegs(handleColorTo("Gold"))).toEqual([
      {
        attributeId: "LegColor",
        target: { scope: "cabinet", cabinetId: cabinets[1] },
        value: "Gold",
        origin: "dependency",
      },
    ]);
  });

  it("stay as they are where no cabinet has legs decided", () => {
    open(["1D", "1D"], ["", ""]);
    expect(plannedLegs(handleColorTo("Gold"))).toEqual([]);
  });
});
