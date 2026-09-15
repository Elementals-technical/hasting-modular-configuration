import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { CabinetEntry, ValueTarget } from "@/entities/configuration";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";

import {
  REASON_GROOVE_NOT_SUPPORTED,
  REASON_HANDLE_CHANGED_FOR_DRAWERS,
  REASON_TOWEL_BAR_COLOR_CLEARED,
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
    ])("keeps the set to the option when %s", (_label, value, towelBarColor) => {
      // toMatchObject compares array length, so a dependency added to the set fails here.
      expect(towelBarPlan(value, towelBarColor)).toMatchObject({ ok: true, plan: [{ attributeId: "TowelBarOption" }] });
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
