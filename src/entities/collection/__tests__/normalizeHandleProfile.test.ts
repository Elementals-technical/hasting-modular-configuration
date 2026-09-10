import { describe, expect, it } from "vitest";

import {
  isHandleAllowedForDrawers,
  normalizeHandleProfile,
  resolveForcedHeight,
  resolvePossibleForcedHeights,
} from "../lib/normalizeHandleProfile";
import type { NormalizedMatrixRow } from "../lib/normalizeHandleProfile";
import { parseProductProfile } from "../lib/parseProductProfile";
import ushProfile from "../../../../public/collections/urban-standard-height/product-profile.json";

const parsed = parseProductProfile(ushProfile);
if (!parsed.ok) throw new Error("USH fixture must parse");

const adapter = parsed.profile.ruleData.cabinetMatrixLegacyAdapter;

const drawerAliases: Record<string, string> = { "1D": "1", "2D": "2", "1DWID": "1+inner" };
const normalizeDrawers = (value: string) => drawerAliases[value] ?? value;

/**
 * Shape of the legacy 439 rows. The numbers are illustrative: the real table payload is
 * not available in the planning package, so these rows prove the mapping, not the values.
 */
const ushRow: NormalizedMatrixRow = {
  cabinet_type: "Sink-Base",
  drawer_configs: "1D|2D",
  handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
  supports_height: "50|53|56",
  handle_pto_forced_height_cm: "1D:50|2D:50",
  handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
  handle_urban_botcut_forced_height_cm: "2D:56",
  handle_urban_botcut_requires_drawers: "2D",
};

describe("normalizeHandleProfile", () => {
  it("maps every handle column declared by the adapter without naming a handle id", () => {
    const { relations } = normalizeHandleProfile({ rows: [ushRow], adapter, normalizeDrawers });

    expect(relations).toHaveLength(1);
    expect(relations[0].forcedHeightByHandle).toEqual({
      handle_pto: { "1": 50, "2": 50 },
      handle_urban_topcut: { "1": 53, "2": 56 },
      handle_urban_botcut: { "2": 56 },
    });
    expect(relations[0].requiresDrawersByHandle).toEqual({ handle_urban_botcut: ["2"] });
  });

  it("emits one flat constraint per cabinet type / handle / drawers triple", () => {
    const { constraints } = normalizeHandleProfile({ rows: [ushRow], adapter, normalizeDrawers });

    expect(constraints).toHaveLength(5);
    expect(constraints).toContainEqual({
      cabinetType: "Sink-Base",
      handleId: "handle_urban_topcut",
      drawers: "2",
      forcedHeightCm: 56,
    });
  });

  it("resolves heights and drawer restrictions through the relation, not a field name", () => {
    const { relations } = normalizeHandleProfile({ rows: [ushRow], adapter, normalizeDrawers });
    const relation = relations[0];

    expect(resolveForcedHeight(relation, "handle_urban_topcut", "1")).toBe(53);
    expect(resolveForcedHeight(relation, "handle_urban_botcut", "1")).toBeNull();
    expect(resolvePossibleForcedHeights(relation, "handle_pto")).toEqual([50, 50]);

    expect(isHandleAllowedForDrawers(relation, "handle_urban_botcut", "2")).toBe(true);
    expect(isHandleAllowedForDrawers(relation, "handle_urban_botcut", "1")).toBe(false);
    // No restriction column means the handle works with any drawers value.
    expect(isHandleAllowedForDrawers(relation, "handle_pto", "1")).toBe(true);
  });

  it("picks up a fourth handle from data alone", () => {
    const extendedAdapter = {
      ...adapter,
      columns: {
        ...adapter.columns,
        forcedHeightByHandle: {
          ...adapter.columns.forcedHeightByHandle,
          test_groove_handle: "test_groove_handle_forced_height_cm",
        },
      },
    };

    const rowWithFourth: NormalizedMatrixRow = {
      ...ushRow,
      handles_allowed: `${ushRow.handles_allowed}|test_groove_handle`,
      test_groove_handle_forced_height_cm: "1D:56|2D:56",
    };

    const { relations } = normalizeHandleProfile({
      rows: [rowWithFourth],
      adapter: extendedAdapter,
      normalizeDrawers,
    });

    expect(relations[0].forcedHeightByHandle.test_groove_handle).toEqual({ "1": 56, "2": 56 });
    expect(resolveForcedHeight(relations[0], "test_groove_handle", "2")).toBe(56);
  });

  it("skips rows without a cabinet type and columns the row does not carry", () => {
    const { relations } = normalizeHandleProfile({
      rows: [{ cabinet_type: "  " }, { cabinet_type: "Open-Shelf" }],
      adapter,
      normalizeDrawers,
    });

    expect(relations).toHaveLength(1);
    expect(relations[0]).toEqual({
      cabinetType: "Open-Shelf",
      forcedHeightByHandle: {},
      requiresDrawersByHandle: {},
    });
  });
});
