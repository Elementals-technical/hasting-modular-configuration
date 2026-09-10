import { describe, expect, it } from "vitest";

import { getPackagedProductProfile } from "@/entities/collection";
import type { ProductProfile } from "@/entities/collection";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { ValueTarget } from "@/entities/configuration";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";

import { REASON_GROOVE_NOT_SUPPORTED, buildChangePlan } from "../lib/buildChangePlan";

const profile = getPackagedProductProfile();
if (!profile) throw new Error("packaged profile must parse");

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
