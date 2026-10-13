import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { getAttributeValue, resetConfiguration, syncCabinets } from "@/entities/configuration";
import { reset, setActiveProfile, setSelectedProductConfig } from "@/entities/product/model/store/slice";

import { commitPlan } from "../lib/commitChange";

const commit = () => {
  const changes = [
    { attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "handle_pto" },
    { attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "2" },
    { attributeId: "CountertopColor", target: { scope: "countertop" }, value: "Cacao Orinoco FF MT" },
    { attributeId: "Thickness", target: { scope: "countertop" }, value: "2.4" },
    { attributeId: "CountertopStyle", target: { scope: "countertop" }, value: "Vessel" },
    { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-1" }, value: "Vessel" },
    { attributeId: "VesselColor", target: { scope: "basin", sinkBaseId: "cab-1" }, value: "White" },
    { attributeId: "DrawerPanelFluting", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "Vertical" },
    { attributeId: "GrainDirection", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "Horizontal" },
    { attributeId: "BookMatching", target: { scope: "global" }, value: "enabled" },
    { attributeId: "TowelBarOption", target: { scope: "global" }, value: "Left" },
    { attributeId: "TowelBarColor", target: { scope: "global" }, value: "Black" },
    { attributeId: "FaucetHolesAmount", target: { scope: "countertop" }, value: "2" },
    { attributeId: "FaucetHolesSpacing", target: { scope: "countertop" }, value: "100" },
    { attributeId: "SidePanels", target: { scope: "global" }, value: "UpperG" },
    { attributeId: "SidePanelLeft", target: { scope: "global" }, value: "active" },
    { attributeId: "SidePanelRight", target: { scope: "global" }, value: "none" },
    { attributeId: "LedOption", target: { scope: "global" }, value: "Led" },
    { attributeId: "DividersOption", target: { scope: "global" }, value: "Option A" },
    {
      attributeId: "DividersStyle",
      target: { scope: "drawer", cabinetId: "cab-2", drawerType: "Top" },
      value: "Option B",
    },
  ] as const;

  const actions = commitPlan(
    changes.map((change) => ({ ...change, origin: "requested" as const })),
    {
      selectedProductConfig: { Drawers: "1D", Handle: "handle_urban_topcut" },
      resolveRuntimeId: (cabinetId) => (cabinetId === "cab-1" ? "Sink-Base-a" : "Sink-Base-b"),
      profile: ushProfile,
    },
  );
  actions.forEach((action) => store.dispatch(action));
};

describe("commitPlan", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
    store.dispatch(syncCabinets(["Sink-Base-a", "Sink-Base-b"]));
  });

  it("records each migrated USH value at the target the runtime applied", () => {
    commit();
    const state = store.getState();

    expect(getAttributeValue(state, "Handle", { scope: "cabinet", cabinetId: "cab-1" })).toBe("handle_pto");
    expect(getAttributeValue(state, "Drawers", { scope: "cabinet", cabinetId: "cab-2" })).toBe("2");
    expect(getAttributeValue(state, "CountertopColor", { scope: "countertop" })).toBe("Cacao Orinoco FF MT");
    expect(getAttributeValue(state, "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBe("Vessel");
    expect(getAttributeValue(state, "VesselColor", { scope: "basin", sinkBaseId: "cab-1" })).toBe("White");
    expect(getAttributeValue(state, "DrawerPanelFluting", { scope: "cabinet", cabinetId: "cab-1" })).toBe("Vertical");
    expect(getAttributeValue(state, "GrainDirection", { scope: "cabinet", cabinetId: "cab-2" })).toBe("Horizontal");
    expect(getAttributeValue(state, "BookMatching", { scope: "global" })).toBe("enabled");
    expect(getAttributeValue(state, "DividersStyle", { scope: "drawer", cabinetId: "cab-2", drawerType: "Top" })).toBe(
      "Option B",
    );
    expect(Object.keys(state.rootStateUI.configuration.valuesByAttributeId).sort()).toEqual(changesInCanonicalOrder);
  });

  // The scene keeps a cutout token where the legacy slice keeps "no basin chosen"; the
  // profile names that token, so the pages no longer spell it out.
  it("records the profile's vessel cutout as no basin, and a chosen basin as itself", () => {
    const commitBasin = (value: string) =>
      commitPlan(
        [{ attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-1" }, value, origin: "requested" }],
        {
          selectedProductConfig: null,
          resolveRuntimeId: () => "Sink-Base-a",
          profile: ushProfile,
        },
      ).forEach((action) => store.dispatch(action));

    commitBasin("Top_HPLPrisma");
    expect(store.getState().rootStateUI.product.productOptions.sinkType).toBe("Top_HPLPrisma");

    commitBasin("Vessel");
    expect(store.getState().rootStateUI.product.productOptions.sinkType).toBe("");
    // The addressed value stays semantic: restore re-applies the cutout the scene needs.
    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBe("Vessel");
  });
});

describe("commitPlan: a value the scene gives every cabinet", () => {
  const cabinetIds = ["cab-1", "cab-2"];
  const valuesOf = (attributeId: string) =>
    cabinetIds.map((cabinetId) => getAttributeValue(store.getState(), attributeId, { scope: "cabinet", cabinetId }));
  const commitAt = (attributeId: string, value: string, context: Partial<Parameters<typeof commitPlan>[1]>) =>
    commitPlan(
      [{ attributeId, target: { scope: "cabinet", cabinetId: "cab-1" }, value, origin: "requested" as const }],
      { selectedProductConfig: null, resolveRuntimeId: () => null, profile: makoProfile, ...context },
    ).forEach((action) => store.dispatch(action));

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(syncCabinets(["Mako-sink-cabinet-a", "Mako-side-cabinet-b"]));
  });

  it("is recorded at every cabinet, as the scene holds it", () => {
    commitAt("HandleColor", "Gold", { bindings: makoRuntimeBindings, cabinetIds });

    expect(valuesOf("HandleColor")).toEqual(["Gold", "Gold"]);
  });

  it("replaces what a model put on the other cabinets", () => {
    commitAt("LegColor", "None", { bindings: makoRuntimeBindings, cabinetIds });
    commitAt("LegColor", "", { bindings: makoRuntimeBindings, cabinetIds });

    expect(valuesOf("LegColor")).toEqual(["", ""]);
  });

  it("is recorded where the change names it when the cabinets or the bindings are not known", () => {
    commitAt("HandleColor", "Gold", { bindings: makoRuntimeBindings });
    expect(valuesOf("HandleColor")).toEqual(["Gold", undefined]);

    commitAt("HandleColor", "Silver", { cabinetIds });
    expect(valuesOf("HandleColor")).toEqual(["Silver", undefined]);
  });

  it("leaves a value with a typed projection at the cabinet the change names", () => {
    commitAt("Handle", "G50", { bindings: makoRuntimeBindings, cabinetIds });

    expect(valuesOf("Handle")).toEqual(["G50", undefined]);
  });
});

const changesInCanonicalOrder = [
  "BookMatching",
  "CountertopColor",
  "CountertopStyle",
  "DividersOption",
  "DividersStyle",
  "DrawerPanelFluting",
  "Drawers",
  "FaucetHolesAmount",
  "FaucetHolesSpacing",
  "GrainDirection",
  "Handle",
  "LedOption",
  "SidePanelLeft",
  "SidePanelRight",
  "SidePanels",
  "Thickness",
  "TowelBarColor",
  "TowelBarOption",
  "VesselColor",
  "sinkType",
];
