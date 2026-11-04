import { describe, expect, it } from "vitest";

import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import { configurator4WithLiveVessels } from "@/entities/collection/__tests__/fixtures/configurator4LiveVessels";
import cabinetTable580 from "@/entities/collection/__tests__/fixtures/remote/datatable-580.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  configuratorSchema,
  parseProductProfile,
  type ConfiguratorGroupCatalog,
  type ProductProfile,
} from "@/entities/collection";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { CabinetEntry, ValueTarget } from "@/entities/configuration";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";

import {
  REASON_GROOVE_NOT_SUPPORTED,
  REASON_HANDLE_CHANGED_FOR_DRAWERS,
  REASON_TOWEL_BAR_COLOR_CLEARED,
  REASON_TOWEL_BAR_COLOR_STARTED,
  buildChangePlan,
} from "../lib/buildChangePlan";

const profile = ushProfile;

/** Matrix rows in the shape the 439 adapter expects. Numbers are the fixture's own. */
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

const catalog = buildCabinetCatalogFromMatrix(matrix, profile);

const cabinetTarget: ValueTarget = { scope: "cabinet", cabinetId: "cab-1" };

const baseSelection: Selection = {
  cabinetType: "Sink-Base",
  width: 60,
  depth: 46,
  height: 53,
  drawers: "1",
  handle: "handle_urban_topcut",
};

const plan = (
  overrides: {
    attributeId?: string;
    value?: string;
    selection?: Partial<Selection>;
    handleGrooveColor?: string | null;
    activeProfile?: ProductProfile;
  } = {},
) =>
  buildChangePlan({
    attributeId: overrides.attributeId ?? "Handle",
    value: overrides.value ?? "handle_pto",
    target: cabinetTarget,
    selection: { ...baseSelection, ...overrides.selection },
    selectedProductIds: [],
    catalog,
    profile: overrides.activeProfile ?? profile,
    handleGrooveColor: overrides.handleGrooveColor ?? null,
  });

describe("buildChangePlan", () => {
  it("always includes the requested change first", () => {
    const result = plan();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan[0]).toMatchObject({
      attributeId: "Handle",
      value: "handle_pto",
      origin: "requested",
      target: cabinetTarget,
    });
  });

  it("adds the rule-driven height to the same set", () => {
    // topcut at 1 drawer forces 53; pto forces 50, so the height must move with it.
    const result = plan({ value: "handle_pto" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan).toContainEqual(
      expect.objectContaining({ attributeId: "Height", value: 50, origin: "dependency" }),
    );
  });

  it("clears the groove colour when the new handle does not support it", () => {
    const result = plan({ value: "handle_pto", handleGrooveColor: "Pulpis Chiaro TKH" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan).toContainEqual(
      expect.objectContaining({
        attributeId: "HandleGrooveColor",
        value: "",
        origin: "dependency",
        reasonCode: REASON_GROOVE_NOT_SUPPORTED,
      }),
    );
  });

  it("keeps the groove colour when moving between two handles that support it", () => {
    const result = plan({
      value: "handle_urban_botcut",
      selection: { drawers: "2" },
      handleGrooveColor: "Pulpis Chiaro TKH",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.some((entry) => entry.attributeId === "HandleGrooveColor")).toBe(false);
  });

  it("does not clear a groove colour that is not set", () => {
    const result = plan({ value: "handle_pto", handleGrooveColor: "" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.some((entry) => entry.attributeId === "HandleGrooveColor")).toBe(false);
  });

  it("blocks a handle the rules disable for the current drawers", () => {
    // Central groove needs two drawers in this fixture.
    const result = plan({ value: "handle_urban_botcut", selection: { drawers: "1" } });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.attributeId).toBe("Handle");
    expect(result.reason).toBe("Available only for selected drawers");
  });

  it("carries no dependencies for an attribute outside the rule selection", () => {
    const result = plan({ attributeId: "LedOption", value: "None" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan).toHaveLength(1);
  });

  describe("drawers", () => {
    const openShelfRow = {
      cabinet_type: "Open-Shelf",
      widths_cm: "40",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "",
      handles_allowed: "",
      supports_height: "50|53|56",
      is_open: "TRUE",
    };
    const compositionCatalog = buildCabinetCatalogFromMatrix(
      { rows: [matrix.rows[0], openShelfRow] } as unknown as ProductDatatable,
      profile,
    );
    const cabinets: CabinetEntry[] = [
      { stableKey: "cab-1", runtimeId: "Sink-Base-60-a", index: 0 },
      { stableKey: "cab-2", runtimeId: "Open-Shelf-40-b", index: 1 },
      { stableKey: "cab-3", runtimeId: "Sink-Base-80-c", index: 2 },
    ];

    const drawersPlan = (value: string, selection: Partial<Selection>, handleGrooveColor: string | null = null) =>
      buildChangePlan({
        attributeId: "Drawers",
        value,
        target: cabinetTarget,
        // The builder's current pick is an open shelf; the drawers are judged for the addressed cabinet.
        selection: { ...baseSelection, cabinetType: "Open-Shelf", ...selection },
        selectedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
        catalog: compositionCatalog,
        profile,
        handleGrooveColor,
        cabinets,
      });

    it("switches every drawer cabinet and skips open cabinets", () => {
      const result = drawersPlan("2", { drawers: "1", handle: "handle_urban_topcut", height: 53 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.plan.filter((entry) => entry.attributeId === "Drawers")).toEqual([
        { attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "2", origin: "requested" },
        { attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-3" }, value: "2", origin: "requested" },
      ]);
      // Upper groove forces 56 at two drawers; the handle itself stays.
      expect(result.plan).toContainEqual(expect.objectContaining({ attributeId: "Height", value: 56 }));
      expect(result.plan.some((entry) => entry.attributeId === "Handle")).toBe(false);
    });

    it("replaces a handle the new drawers do not allow, with that handle's height and groove reset", () => {
      const result = drawersPlan("1", { drawers: "2", handle: "handle_urban_botcut", height: 56 }, "Pulpis Chiaro TKH");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.plan.slice(2)).toEqual([
        {
          attributeId: "Handle",
          target: cabinetTarget,
          value: "handle_pto",
          origin: "dependency",
          reasonCode: REASON_HANDLE_CHANGED_FOR_DRAWERS,
        },
        expect.objectContaining({ attributeId: "Height", value: 50, origin: "dependency" }),
        expect.objectContaining({
          attributeId: "HandleGrooveColor",
          value: "",
          reasonCode: REASON_GROOVE_NOT_SUPPORTED,
        }),
      ]);
    });

    it("addresses only the requested cabinet when no placed cabinet is recognised", () => {
      const result = buildChangePlan({
        attributeId: "Drawers",
        value: "2",
        target: cabinetTarget,
        selection: baseSelection,
        selectedProductIds: [],
        catalog,
        profile,
        handleGrooveColor: null,
        cabinets: [{ stableKey: "cab-1", runtimeId: "runtime-a", index: 0 }],
      });

      expect(result.ok ? result.plan.filter((entry) => entry.attributeId === "Drawers") : []).toHaveLength(1);
    });
  });

  describe("towel bar", () => {
    const towelBarPlan = (value: string, towelBarColor: string | null) =>
      buildChangePlan({
        attributeId: "TowelBarOption",
        value,
        target: { scope: "global" },
        selection: baseSelection,
        selectedProductIds: [],
        catalog,
        profile,
        handleGrooveColor: null,
        towelBarColor,
      });

    it("clears the colour when the towel bar is removed", () => {
      expect(towelBarPlan("None", "Chrome")).toEqual({
        ok: true,
        plan: [
          { attributeId: "TowelBarOption", target: { scope: "global" }, value: "None", origin: "requested" },
          {
            attributeId: "TowelBarColor",
            target: { scope: "global" },
            value: "",
            origin: "dependency",
            reasonCode: REASON_TOWEL_BAR_COLOR_CLEARED,
          },
        ],
      });
    });

    it.each([
      ["removing it without a colour", "None", ""],
      ["moving it to another side", "Left", "Chrome"],
      // USH declares no starting colour for the bar, so hanging one adds nothing to the set.
      ["hanging it where the collection declares no starting colour", "Left", ""],
    ])("keeps the set to the option when %s", (_label, value, towelBarColor) => {
      // toMatchObject compares array length, so a dependency added to the set fails here.
      expect(towelBarPlan(value, towelBarColor)).toMatchObject({ ok: true, plan: [{ attributeId: "TowelBarOption" }] });
    });
  });

  describe("countertop style", () => {
    const basinTarget: ValueTarget = { scope: "basin", sinkBaseId: "cab-1" };
    const stylePlan = (value: string, sinkType: string, vesselColor: string, sinkBaseIds = ["cab-1"]) =>
      buildChangePlan({
        attributeId: "CountertopStyle",
        value,
        target: { scope: "countertop" },
        selection: baseSelection,
        selectedProductIds: [],
        catalog,
        profile,
        handleGrooveColor: null,
        basin: { sinkBaseIds, sinkType, vesselColor },
      });

    it("clears the basin of every Sink Base and of the composition, as a basin goes on every one", () => {
      expect(stylePlan("vessel", "Top_HPLPrisma", "", ["cab-1", "cab-2"])).toMatchObject({
        ok: true,
        plan: [
          { attributeId: "CountertopStyle" },
          { attributeId: "sinkType", target: { scope: "basin" }, value: "" },
          { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-1" }, value: "" },
          { attributeId: "sinkType", target: { scope: "basin", sinkBaseId: "cab-2" }, value: "" },
        ],
      });
    });

    it("clears an integrated basin when the style changes to vessel", () => {
      expect(stylePlan("vessel", "Top_HPLPrisma", "")).toEqual({
        ok: true,
        plan: [
          { attributeId: "CountertopStyle", target: { scope: "countertop" }, value: "vessel", origin: "requested" },
          { attributeId: "sinkType", target: { scope: "basin" }, value: "", origin: "dependency" },
          { attributeId: "sinkType", target: basinTarget, value: "", origin: "dependency" },
        ],
      });
    });

    it("clears the vessel and its colour when the style leaves vessel", () => {
      expect(stylePlan("integrated", "Vessel_Blade11", "Bianco")).toMatchObject({
        ok: true,
        plan: [
          { attributeId: "CountertopStyle", value: "integrated" },
          { attributeId: "sinkType", target: { scope: "basin" }, value: "", origin: "dependency" },
          { attributeId: "sinkType", target: basinTarget, value: "", origin: "dependency" },
          { attributeId: "VesselColor", target: { scope: "basin" }, value: "", origin: "dependency" },
          { attributeId: "VesselColor", target: basinTarget, value: "", origin: "dependency" },
        ],
      });
    });

    it.each([
      ["no basin is chosen", "vessel", ""],
      ["the basin is of the chosen style", "integrated", "Top_HPLPrisma"],
    ])("keeps the set to the style when %s", (_label, style, sinkType) => {
      // toMatchObject compares array length, so a dependency added to the set fails here.
      expect(stylePlan(style, sinkType, "")).toMatchObject({ ok: true, plan: [{ attributeId: "CountertopStyle" }] });
    });
  });

  describe("a picked basin", () => {
    const { availableOptions } = configuratorSchema.parse(configurator4WithLiveVessels);
    const configurator: ConfiguratorGroupCatalog = {
      groups: availableOptions,
      groupsByName: Object.fromEntries(availableOptions.map((group) => [group.proxyName, group])),
    };
    const basinTarget: ValueTarget = { scope: "basin" };

    const basinPlan = ({
      value = "Vessel_UrbanModo",
      vesselColor = "",
      sinkBaseIds = ["cab-1", "cab-2"],
      target = basinTarget,
      activeConfigurator = configurator,
    }: {
      value?: string;
      vesselColor?: string;
      sinkBaseIds?: string[];
      target?: ValueTarget;
      activeConfigurator?: ConfiguratorGroupCatalog | null;
    } = {}) =>
      buildChangePlan({
        attributeId: "sinkType",
        value,
        target,
        selection: baseSelection,
        selectedProductIds: [],
        catalog,
        profile,
        handleGrooveColor: null,
        basin: { sinkBaseIds, sinkType: "", vesselColor },
        configurator: activeConfigurator,
      });

    const colourEntries = (value: string, targets: ValueTarget[]) =>
      targets.map((target) => ({ attributeId: "VesselColor", target, value, origin: "dependency" }));

    const everyTarget: ValueTarget[] = [
      { scope: "basin" },
      { scope: "basin", sinkBaseId: "cab-1" },
      { scope: "basin", sinkBaseId: "cab-2" },
    ];

    const requestedEntries = (value: string, targets: ValueTarget[]) =>
      targets.map((target) => ({ attributeId: "sinkType", target, value, origin: "requested" }));

    it("gives a vessel without a colour its default finish, on the composition and every Sink Base", () => {
      expect(basinPlan()).toEqual({
        ok: true,
        plan: [...requestedEntries("Vessel_UrbanModo", everyTarget), ...colourEntries("Matte White T1C", everyTarget)],
      });
    });

    it("keeps a colour the vessel allows", () => {
      expect(basinPlan({ vesselColor: "Matte Black T1D" })).toEqual({
        ok: true,
        plan: requestedEntries("Vessel_UrbanModo", everyTarget),
      });
    });

    it("replaces a colour the vessel refuses on every target", () => {
      expect(basinPlan({ vesselColor: "Antracite Matte OCF" })).toEqual({
        ok: true,
        plan: [...requestedEntries("Vessel_UrbanModo", everyTarget), ...colourEntries("Matte White T1C", everyTarget)],
      });
    });

    it.each([
      ["the cutout without a vessel", "Vessel"],
      ["an integrated basin", "Top_HPLPrisma"],
    ])("leaves the colour alone on %s", (_label, value) => {
      expect(basinPlan({ value, vesselColor: "Antracite Matte OCF" })).toEqual({
        ok: true,
        plan: requestedEntries(value, everyTarget),
      });
    });

    it("leaves the colour alone without a placed Sink Base", () => {
      expect(basinPlan({ sinkBaseIds: [], vesselColor: "Antracite Matte OCF" })).toEqual({
        ok: true,
        plan: requestedEntries("Vessel_UrbanModo", [basinTarget]),
      });
    });

    it("leaves the colour alone before the configurator loads", () => {
      expect(basinPlan({ activeConfigurator: null, vesselColor: "Antracite Matte OCF" })).toEqual({
        ok: true,
        plan: requestedEntries("Vessel_UrbanModo", everyTarget),
      });
    });

    it("keeps a value addressed at one Sink Base on that Sink Base, colour included", () => {
      const oneSinkBase: ValueTarget = { scope: "basin", sinkBaseId: "cab-2" };

      expect(basinPlan({ target: oneSinkBase })).toEqual({
        ok: true,
        plan: [
          ...requestedEntries("Vessel_UrbanModo", [oneSinkBase]),
          ...colourEntries("Matte White T1C", [oneSinkBase]),
        ],
      });
    });
  });

  it("drives a synthetic handle through the same evaluator", () => {
    const extendedProfile: ProductProfile = {
      ...profile,
      attributes: profile.attributes.map((attribute) =>
        attribute.attributeId === "Handle"
          ? {
              ...attribute,
              options: [
                ...(attribute.options ?? []),
                {
                  value: "test_groove_handle",
                  label: "Test Groove",
                  order: 40,
                  capabilities: { supportsGrooveColor: true },
                },
              ],
            }
          : attribute,
      ),
      ruleData: {
        cabinetMatrixLegacyAdapter: {
          ...profile.ruleData.cabinetMatrixLegacyAdapter,
          columns: {
            ...profile.ruleData.cabinetMatrixLegacyAdapter.columns,
            forcedHeightByHandle: {
              ...profile.ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeightByHandle,
              test_groove_handle: "test_groove_handle_forced_height_cm",
            },
          },
        },
      },
    };

    const extendedCatalog = buildCabinetCatalogFromMatrix(
      {
        rows: [
          {
            ...matrix.rows[0],
            handles_allowed: `${matrix.rows[0].handles_allowed}|test_groove_handle`,
            test_groove_handle_forced_height_cm: "1D:56|2D:56",
          },
        ],
      } as unknown as ProductDatatable,
      extendedProfile,
    );

    const result = buildChangePlan({
      attributeId: "Handle",
      value: "test_groove_handle",
      target: cabinetTarget,
      selection: baseSelection,
      selectedProductIds: [],
      catalog: extendedCatalog,
      profile: extendedProfile,
      handleGrooveColor: "Pulpis Chiaro TKH",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Appears in the set, brings its own height, and keeps the colour by capability.
    expect(result.plan[0].value).toBe("test_groove_handle");
    expect(result.plan).toContainEqual(expect.objectContaining({ attributeId: "Height", value: 56 }));
    expect(result.plan.some((entry) => entry.attributeId === "HandleGrooveColor")).toBe(false);
  });
});

/**
 * Urban Low Height: a handle takes two heights (upper groove 38/28 cm, push-to-open 35/25 cm),
 * so a change of handle moves the cabinets to the nearest height the new handle takes.
 */
describe("buildChangePlan: a handle that takes several heights", () => {
  const parsedUlh = parseProductProfile(ulhProfileDocument);
  if (!parsedUlh.ok) throw new Error("Urban Low Height profile must parse");
  const ulhProfile = parsedUlh.profile;
  // The Urban Low Height cabinet table the collection loads (580).
  const ulhCatalog = buildCabinetCatalogFromMatrix(cabinetTable580 as ProductDatatable, ulhProfile);

  const ulhPlan = (overrides: { height?: number; handleGrooveColor?: string } = {}) => {
    const result = buildChangePlan({
      attributeId: "Handle",
      value: "handle_pto",
      target: cabinetTarget,
      selection: {
        cabinetType: "Sink-Base",
        width: 60,
        depth: 46,
        height: overrides.height ?? 38,
        drawers: "1",
        handle: "handle_urban_topcut",
      },
      selectedProductIds: [],
      catalog: ulhCatalog,
      profile: ulhProfile,
      handleGrooveColor: overrides.handleGrooveColor ?? null,
    });
    if (!result.ok) throw new Error(result.reason);

    return result.plan;
  };

  const heightOf = (entries: ReturnType<typeof ulhPlan>) =>
    entries.find(({ attributeId }) => attributeId === "Height")?.value;

  it("moves to the nearest height of the new handle", () => {
    const entries = ulhPlan();

    expect(entries[0]).toMatchObject({ attributeId: "Handle", value: "handle_pto", origin: "requested" });
    expect(heightOf(entries)).toBe(35);
    expect(heightOf(ulhPlan({ height: 28 }))).toBe(25);
  });

  it("still clears the groove colour push-to-open has no groove for", () => {
    const entries = ulhPlan({ handleGrooveColor: "Rox Black TKQ" });

    expect(entries).toContainEqual(expect.objectContaining({ attributeId: "HandleGrooveColor", origin: "dependency" }));
    expect(heightOf(entries)).toBe(35);
  });
});

/**
 * Urban Low Height declares a starting towel-bar colour on the attribute, so hanging a bar carries
 * the colour in the same set (ULH-14, UF-2): a colour only in the store would never reach the scene.
 */
describe("buildChangePlan: a towel bar that starts in a colour", () => {
  const parsed = parseProductProfile(ulhProfileDocument);
  if (!parsed.ok) throw new Error("Urban Low Height profile must parse");
  const ulhProfile = parsed.profile;
  const STARTING_COLOR = "Carbone 43 MT";

  const towelBarPlan = (value: string, towelBarColor: string | null) => {
    const result = buildChangePlan({
      attributeId: "TowelBarOption",
      value,
      target: { scope: "global" },
      selection: baseSelection,
      selectedProductIds: [],
      catalog,
      profile: ulhProfile,
      handleGrooveColor: null,
      towelBarColor,
    });
    if (!result.ok) throw new Error(result.reason);

    return result.plan;
  };

  const colorOf = (entries: ReturnType<typeof towelBarPlan>) =>
    entries.find(({ attributeId }) => attributeId === "TowelBarColor");

  it.each(["Left", "Right", "Both"])("gives the bar its starting colour when it is hung on %s", (side) => {
    const entries = towelBarPlan(side, "");

    expect(entries[0]).toMatchObject({ attributeId: "TowelBarOption", value: side, origin: "requested" });
    expect(colorOf(entries)).toEqual({
      attributeId: "TowelBarColor",
      target: { scope: "global" },
      value: STARTING_COLOR,
      origin: "dependency",
      reasonCode: REASON_TOWEL_BAR_COLOR_STARTED,
    });
  });

  it("leaves a chosen colour alone when the bar moves to the other side", () => {
    expect(colorOf(towelBarPlan("Right", "Nero 03 MT"))).toBeUndefined();
  });

  it("gives the colour again after a removal cleared it", () => {
    // Left -> None -> Left: the removal clears the colour, so the next hang has to bring it back.
    expect(colorOf(towelBarPlan("None", STARTING_COLOR))).toMatchObject({
      value: "",
      reasonCode: REASON_TOWEL_BAR_COLOR_CLEARED,
    });
    expect(colorOf(towelBarPlan("Left", ""))).toMatchObject({
      value: STARTING_COLOR,
      reasonCode: REASON_TOWEL_BAR_COLOR_STARTED,
    });
  });
});
