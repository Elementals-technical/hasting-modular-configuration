import { describe, expect, it } from "vitest";

import ushProfile from "../../../../../public/collections/urban-standard-height/product-profile.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import makoCabinetTable from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import { parseProductProfile } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { ProductDatatable } from "@/entities/product/api";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { applyConfiguratorRules } from "..";
import { buildHandleStyleConfigPatch } from "../lib/handleStyleConfig";
import { resolveHandleAfterRules } from "../lib/resolveHandleAfterRules";

const parsed = parseProductProfile(ushProfile);
if (!parsed.ok) throw new Error("USH fixture must parse");
const profile: ProductProfile = parsed.profile;

const parsedClass = parseProductProfile(classProfileDocument);
if (!parsedClass.ok) throw new Error("Class profile must parse");
const classProfile: ProductProfile = parsedClass.profile;

/**
 * Matrix rows in the shape the 439 adapter expects. The concrete numbers are the
 * fixture's own; the real table payload is not in the planning package, so these prove
 * the mapping and the parity of the rule shape, not the production values.
 */
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

const catalog: ConfiguratorCatalog = buildCabinetCatalogFromMatrix(matrix, profile);

const run = (
  overrides: Partial<{ drawers: string | null; handle: string | null; height: number }> = {},
  activeProfile: ProductProfile | null = profile,
) =>
  applyConfiguratorRules(
    {
      cabinetType: "Sink-Base",
      width: 60,
      depth: 46,
      height: overrides.height ?? 53,
      drawers: "drawers" in overrides ? overrides.drawers : "1",
      handle: "handle" in overrides ? overrides.handle : null,
    },
    undefined,
    { selectedProductIds: [] },
    catalog,
    activeProfile,
  );

describe("handleRule on profile data", () => {
  it("builds the handle catalog from the profile, in catalog order", () => {
    const result = run();

    expect(result.availableOptions.handles.map((option) => option.value)).toEqual([
      "handle_pto",
      "handle_urban_topcut",
      "handle_urban_botcut",
    ]);
    expect(result.availableOptions.handles.map((option) => option.label)).toEqual([
      "Push to open",
      "Upper Groove",
      "Central Groove",
    ]);
  });

  it("keeps the legacy drawer dependency: central groove needs the allowed drawers", () => {
    const withOneDrawer = run({ drawers: "1" });
    const withTwoDrawers = run({ drawers: "2" });

    const botcutAtOne = withOneDrawer.availableOptions.handles.find((o) => o.value === "handle_urban_botcut");
    const botcutAtTwo = withTwoDrawers.availableOptions.handles.find((o) => o.value === "handle_urban_botcut");

    expect(botcutAtOne?.enabled).toBe(false);
    expect(botcutAtOne?.reason).toBe("Available only for selected drawers");
    expect(botcutAtTwo?.enabled).toBe(true);
  });

  it("uses the declared fallback message when no handle is chosen yet", () => {
    const result = run({ handle: null, drawers: "1" });
    const constrained = result.availableOptions.height.filter((option) => !option.enabled && option.reason);

    expect(constrained.every((option) => option.reason === "Required for selected handle and all products")).toBe(true);
    expect(result.availableOptions.height.find((option) => option.enabled)?.value).toBe(53);
  });

  it("uses the plain message for an explicitly chosen handle", () => {
    const result = run({ handle: "handle_pto", drawers: "1" });

    expect(result.availableOptions.height.find((option) => option.value === 53)?.reason).toBe(
      "Required for selected handle",
    );
    expect(result.availableOptions.height.find((option) => option.value === 50)?.enabled).toBe(true);
  });

  it("asks for drawers when the chosen handle needs them to determine the height", () => {
    const result = run({ handle: "handle_urban_topcut", drawers: null });

    expect(result.violations).toContainEqual({
      field: "drawers",
      reason: "Select drawers to determine height for selected handle",
      reasonCode: "handle.selectDrawersForHeight",
    });
  });

  it("marks handles that the cabinet type does not allow", () => {
    const restricted = buildCabinetCatalogFromMatrix(
      {
        rows: [{ ...matrix.rows[0], handles_allowed: "handle_pto" }],
      } as unknown as ProductDatatable,
      profile,
    );

    const result = applyConfiguratorRules(
      { cabinetType: "Sink-Base", width: 60, depth: 46, height: 50, drawers: "1", handle: null },
      undefined,
      { selectedProductIds: [] },
      restricted,
      profile,
    );

    const topcut = result.availableOptions.handles.find((o) => o.value === "handle_urban_topcut");
    expect(topcut?.enabled).toBe(false);
    expect(topcut?.reason).toBe("Not available for selected cabinet type");
  });

  it("produces no handles at all for a collection whose profile declares none", () => {
    const emptyProfile: ProductProfile = {
      ...profile,
      collectionId: "no-handles",
      attributes: profile.attributes.filter((attribute) => attribute.attributeId !== "Handle"),
    };

    const result = run({}, emptyProfile);

    expect(result.availableOptions.handles).toEqual([]);
  });
});

describe("extension: a fourth handle from fixture data only", () => {
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
          handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut|test_groove_handle",
          test_groove_handle_forced_height_cm: "1D:56|2D:56",
        },
      ],
    } as unknown as ProductDatatable,
    extendedProfile,
  );

  it("appears as an enabled option without touching any component or reducer", () => {
    const result = applyConfiguratorRules(
      { cabinetType: "Sink-Base", width: 60, depth: 46, height: 56, drawers: "1", handle: "test_groove_handle" },
      undefined,
      { selectedProductIds: [] },
      extendedCatalog,
      extendedProfile,
    );

    const option = result.availableOptions.handles.find((o) => o.value === "test_groove_handle");

    expect(option).toBeDefined();
    expect(option?.enabled).toBe(true);
    expect(option?.label).toBe("Test Groove");
  });

  it("drives its own forced height", () => {
    const result = applyConfiguratorRules(
      { cabinetType: "Sink-Base", width: 60, depth: 46, height: 56, drawers: "1", handle: "test_groove_handle" },
      undefined,
      { selectedProductIds: [] },
      extendedCatalog,
      extendedProfile,
    );

    expect(result.availableOptions.height.find((option) => option.enabled)?.value).toBe(56);
  });

  it("keeps its groove color because the capability, not the id, decides", () => {
    expect(buildHandleStyleConfigPatch("test_groove_handle", "Pulpis Chiaro TKH", extendedProfile)).toEqual({
      Handle: "test_groove_handle",
    });
  });

  it("is not inherited by a profile that declares its own handles", () => {
    const otherCollection: ProductProfile = {
      ...profile,
      collectionId: "other",
      attributes: profile.attributes.map((attribute) =>
        attribute.attributeId === "Handle"
          ? {
              ...attribute,
              options: [{ value: "other_handle", label: "Other", order: 10 }],
              effectiveFallbackValue: undefined,
            }
          : attribute,
      ),
    };

    const result = run({}, otherCollection);

    expect(result.availableOptions.handles.map((o) => o.value)).toEqual(["other_handle"]);
  });
});

describe("a table with one forced height column for all handles", () => {
  const universalTable = (rows: Record<string, string>[]) => ({ rows }) as unknown as ProductDatatable;
  const runFirst = (
    tableProfile: ProductProfile,
    tableCatalog: ConfiguratorCatalog,
    selection: { cabinetType: string; height: number; drawers: string | null; handle: string | null },
  ) =>
    applyConfiguratorRules(
      { width: 60, depth: 52, ...selection },
      undefined,
      { selectedProductIds: [] },
      tableCatalog,
      tableProfile,
    );

  it("gives a Mako cabinet the height of its drawers before any handle is chosen", () => {
    // The Mako cabinet table the collection loads (581).
    const makoCatalog = buildCabinetCatalogFromMatrix(makoCabinetTable, makoProfile);

    const oneDrawer = runFirst(makoProfile, makoCatalog, {
      cabinetType: "Sink-Base",
      height: 52,
      drawers: "1",
      handle: null,
    });
    expect(oneDrawer.nextSelection.height).toBe(26);
    expect(oneDrawer.availableOptions.height.find((option) => option.value === 52)?.reason).toBe(
      "Required for selected drawers",
    );

    const withHandle = runFirst(makoProfile, makoCatalog, {
      cabinetType: "Sink-Base",
      height: 26,
      drawers: "2",
      handle: "G50",
    });
    expect(withHandle.nextSelection.height).toBe(52);

    const sideCabinet = runFirst(makoProfile, makoCatalog, {
      cabinetType: "Sink-Cabinet",
      height: 52,
      drawers: "1",
      handle: "G57",
    });
    expect(sideCabinet.nextSelection.height).toBe(26);
  });

  it("gives a Class cabinet the height of its drawers, although Class has no handle", () => {
    const classCatalog = buildCabinetCatalogFromMatrix(
      universalTable([
        {
          cabinet_type: "Sink-Base",
          widths_cm: "60|80",
          depths_cm: "52",
          heights_cm: "40|52",
          drawer_configs: "1|1+inner|2",
          has_sink: "TRUE",
          is_open: "FALSE",
          handles_allowed: "",
          supports_height: "40|52",
          forced_height_cm: "1:40|1+inner:40|2:52",
        },
      ]),
      classProfile,
    );

    const inner = runFirst(classProfile, classCatalog, {
      cabinetType: "Sink-Base",
      height: 52,
      drawers: "1+inner",
      handle: null,
    });
    expect(inner.nextSelection.height).toBe(40);
    expect(inner.availableOptions.handles).toEqual([]);
  });
});

describe("groove color capability", () => {
  it("clears the color when leaving a groove handle for one without the capability", () => {
    expect(buildHandleStyleConfigPatch("handle_pto", "Pulpis Chiaro TKH", profile)).toEqual({
      Handle: "handle_pto",
      HandleGrooveColor: "None",
    });
  });

  it("keeps the color when moving between two groove handles", () => {
    expect(buildHandleStyleConfigPatch("handle_urban_botcut", "Pulpis Chiaro TKH", profile)).toEqual({
      Handle: "handle_urban_botcut",
    });
  });

  it("still resets when the groove handle has no active color", () => {
    expect(buildHandleStyleConfigPatch("handle_urban_topcut", "None", profile)).toEqual({
      Handle: "handle_urban_topcut",
      HandleGrooveColor: "None",
    });
  });
});

describe("resolveHandleAfterRules", () => {
  const handles = [
    { value: "handle_pto", label: "Push to open", enabled: true },
    { value: "handle_urban_topcut", label: "Upper Groove", enabled: false },
    { value: "handle_urban_botcut", label: "Central Groove", enabled: false },
  ];

  it("keeps a handle that is still selectable", () => {
    expect(resolveHandleAfterRules({ currentHandle: "handle_pto", handles, heightLocked: 50 })).toBe("handle_pto");
  });

  it("falls back to the first enabled option when the current one is locked out", () => {
    expect(resolveHandleAfterRules({ currentHandle: "handle_urban_topcut", handles, heightLocked: 50 })).toBe(
      "handle_pto",
    );
  });

  it("picks a handle when none is selected and a height is locked", () => {
    expect(resolveHandleAfterRules({ currentHandle: null, handles, heightLocked: 50 })).toBe("handle_pto");
  });

  it("does not invent a handle when nothing is locked", () => {
    expect(resolveHandleAfterRules({ currentHandle: null, handles, heightLocked: null })).toBeNull();
  });

  it("respects deferAutoChange", () => {
    const deferred = [
      { value: "handle_pto", label: "Push to open", enabled: true },
      { value: "handle_urban_botcut", label: "Central Groove", enabled: false, deferAutoChange: true },
    ];

    expect(
      resolveHandleAfterRules({ currentHandle: "handle_urban_botcut", handles: deferred, heightLocked: null }),
    ).toBe("handle_urban_botcut");
  });
});
