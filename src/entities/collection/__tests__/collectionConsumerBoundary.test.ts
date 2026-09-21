import { describe, expect, it } from "vitest";

const sourceModules = import.meta.glob("/src/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const productionSources = Object.entries(sourceModules).filter(
  ([path]) => !path.includes("/__tests__/") && !path.includes(".test."),
);

const prohibitedHookCalls = [
  /\buseGetConfiguratorQuery\s*\(/,
  /\buseGetCountertopDatatableQuery\s*\(/,
  /\buseGetProductDatatableQuery\s*\(/,
];

const hardcodedSourceIds = [
  /\bconfiguratorId\s*[:=]\s*4\b/,
  /\bcountertop(?:Matrix)?TableId\s*[:=]\s*438\b/i,
  /\bcabinet(?:Matrix)?TableId\s*[:=]\s*439\b/i,
  /\btableId\s*[:=]\s*(?:438|439)\b/,
];

/** Calls that reach the scene directly, bypassing the command path and its state record. */
const directSceneCalls = [
  /\bsetConfigBatch\s*\(/,
  /\bsetConfig\s*\(/,
  /\baddPreset\s*\(/,
  /\baddProduct\s*\(/,
  /\bremoveAllProducts\s*\(/,
];

/** The scene wrappers themselves and the adapter that is allowed to use them (I02). */
const SCENE_INFRASTRUCTURE = [
  "/src/utils/functions/playcanvas/",
  "/src/features/playCanvasAdapter/",
  "/src/entities/collection/model/runtimeBindings.ts",
];

/** Who removes a residue (B pages, C state and commands, I scene), and what it waits for (DEV-10). */
type Residue = { owner: "B" | "C" | "I"; reason: string };

/**
 * Consumers that still call the scene directly, with who removes each call.
 * A file leaves the list when its calls go; a new direct call in a file that is already
 * clean fails the test. The list only shrinks (DEV-10).
 */
const PENDING_DIRECT_SCENE_CALLERS: Record<string, Residue> = {
  "/src/pages/prebuilt/countertop/CountertopPage.tsx": {
    owner: "B",
    reason: "B06: basin, vessel colour and countertop fields to the existing commands",
  },
  "/src/pages/custom/countertop/index.tsx": {
    owner: "B",
    reason: "B06: basin, vessel colour and countertop fields to the existing commands",
  },
  "/src/pages/prebuilt/model/ModelPage.tsx": {
    owner: "C",
    reason: "composition command: apply a preset, clear the scene; then B08",
  },
  "/src/pages/custom/cabinetBuilder/CabinetBuilderPage.tsx": {
    owner: "C",
    reason: "composition command: add a product, apply a preset; then B09",
  },
  "/src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx": {
    owner: "I",
    reason: "scene widget: countertop follow-up, duplicate, towel bar removal, divider reset; divider bindings",
  },
  "/src/pages/prebuilt/accessories/AccessoriesPage.tsx": { owner: "B", reason: "B06: towel bar field to its command" },
  "/src/pages/custom/accessories/index.tsx": { owner: "B", reason: "B06: towel bar field to its command" },
  "/src/features/bottomCanvasButtons/BottomCanvasButtons.tsx": {
    owner: "B",
    reason: "commented-out reset and preset code only; deleting it clears the file",
  },
  "/src/features/StepNavigationBar/StepNavigationBar.tsx": {
    owner: "C",
    reason: "composition command: clear the scene when leaving the flow; side panel reset needs I bindings",
  },
  "/src/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar.tsx": {
    owner: "B",
    reason: "B06: dimensions and vessel colour to changeDimension and the existing commands",
  },
  "/src/entities/product/ui/createModelBtn/CreateModelBtn.tsx": {
    owner: "C",
    reason: "composition command: clear the scene",
  },
  "/src/app/store/optionsListener.ts": { owner: "C", reason: "C06: handle sync from state to scene" },
  "/src/entities/history/lib/restoreSnapshot.ts": {
    owner: "C",
    reason: "DEV-09: undo and redo through the restore path",
  },
};

/** Material matching by the legacy alias table: a helper called without the collection's table. */
const legacyAliasLookups = [/\bgetMaterialAliases\([^,()]+\)/, /\bmaterialMatchesRule\([^,()]+,[^,()]+\)/];

/**
 * Rules match countertop materials by the collection's `ruleData.materialNormalization`
 * (DEV-06). These still fall back to the legacy table, kept equal to USH's by
 * `materialAliases.test.ts`. The rule files take the table once their callers pass the profile.
 */
const PENDING_LEGACY_ALIAS_CALLERS: Record<string, Residue> = {
  "/src/pages/prebuilt/countertop/CountertopPage.tsx": { owner: "B", reason: "B06: material filters of the page" },
  "/src/pages/custom/countertop/index.tsx": { owner: "B", reason: "B06: material filters of the page" },
  "/src/features/configurator-rule-core/countertop/basinSelection.ts": {
    owner: "C",
    reason: "called without a profile by the model page",
  },
  "/src/features/configurator-rule-core/countertop/lengthLimits.ts": {
    owner: "C",
    reason: "called without a profile by the scene widget and the sidebar",
  },
  "/src/features/configurator-rule-core/countertop/parse.ts": {
    owner: "C",
    reason: "basin material scope, read without a profile by basinSelection and the countertop pages",
  },
  "/src/features/configurator-rule-core/countertop/rules.ts": {
    owner: "C",
    reason: "called without a profile by pages, Summary and pricing (D)",
  },
  "/src/features/configurator-rule-core/countertop/sizeFilters.ts": {
    owner: "C",
    reason: "width filter called without a profile by the scene widget and the sidebar",
  },
};

/**
 * Product catalogs the pages still declare themselves. The USH profile holds each one with
 * the same values and labels (`pageCatalogsMatchProfile.test.ts`); B06 replaces them with
 * `selectOptions` / `selectBasinOptions`, see docs/b06-profile-options-handoff.md.
 */
const PENDING_PAGE_CATALOGS: Record<string, { owner: "B"; constants: string[] }> = {
  "/src/pages/prebuilt/countertop/constants.ts": {
    owner: "B",
    constants: ["optionsMockData2", "optionsMockData3", "optionsMockData4"],
  },
  "/src/pages/custom/countertop/constants.ts": {
    owner: "B",
    constants: ["optionsMockData2", "optionsMockData3", "optionsMockData4"],
  },
  "/src/pages/prebuilt/accessories/constants.ts": {
    owner: "B",
    constants: ["optionsSidePanelsData", "optionsSwatchData2", "optionsSwatchDataTowel", "dividersMockData"],
  },
  "/src/pages/custom/accessories/constants.ts": {
    owner: "B",
    constants: ["optionsSidePanelsData", "optionsSwatchData2", "optionsSwatchDataTowel", "dividersMockData"],
  },
};

const findOffenders = (patterns: RegExp[]) =>
  productionSources.flatMap(([path, source]) =>
    patterns.filter((pattern) => pattern.test(source)).map((pattern) => `${path}: ${pattern.source}`),
  );

describe("active collection consumer boundary", () => {
  it("keeps collection-owned RTK Query hooks inside loader infrastructure", () => {
    expect(findOffenders(prohibitedHookCalls)).toEqual([]);
  });

  it("keeps known remote source IDs out of production TypeScript contracts", () => {
    expect(findOffenders(hardcodedSourceIds)).toEqual([]);
  });

  it("adds no direct scene call outside the wrappers and the files still waiting for a wave", () => {
    const callers = productionSources
      .filter(([path]) => !SCENE_INFRASTRUCTURE.some((allowed) => path.startsWith(allowed)))
      .filter(([, source]) => directSceneCalls.some((pattern) => pattern.test(source)))
      .map(([path]) => path);

    expect(callers.filter((path) => !(path in PENDING_DIRECT_SCENE_CALLERS))).toEqual([]);
  });

  it("keeps the pending list honest: a migrated file leaves it", () => {
    const stillCalling = productionSources
      .filter(([, source]) => directSceneCalls.some((pattern) => pattern.test(source)))
      .map(([path]) => path);

    expect(Object.keys(PENDING_DIRECT_SCENE_CALLERS).filter((path) => !stillCalling.includes(path))).toEqual([]);
  });

  it("matches materials by the legacy alias table only in the files still waiting for the profile", () => {
    const callers = productionSources
      .filter(([, source]) => legacyAliasLookups.some((pattern) => pattern.test(source)))
      .map(([path]) => path);

    expect(callers.filter((path) => !(path in PENDING_LEGACY_ALIAS_CALLERS))).toEqual([]);
    expect(Object.keys(PENDING_LEGACY_ALIAS_CALLERS).filter((path) => !callers.includes(path))).toEqual([]);
  });

  it("keeps the page catalog list honest: a catalog the page dropped leaves it", () => {
    const dropped = Object.entries(PENDING_PAGE_CATALOGS).flatMap(([path, { constants }]) =>
      constants.filter((name) => !new RegExp(`\\bexport const ${name}\\b`).test(sourceModules[path] ?? "")),
    );

    expect(dropped).toEqual([]);
  });
});
