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
  /\bsetConfigBatch\s*\(/g,
  /\bsetConfig\s*\(/g,
  /\baddPreset\s*\(/g,
  /\baddProduct\s*\(/g,
  /\bremoveAllProducts\s*\(/g,
  /\bsetSidePanel\s*\(/g,
  /\bsetProductByParams\s*\(/g,
  /\bremoveProduct\s*\(/g,
  /\bclearPlacedDividersInScene\s*\(/g,
  /\bresetSidePanels\s*\(/g,
  /\bswapProducts\s*\(/g,
];

/** The scene wrappers themselves and the adapters that are allowed to use them (I02). */
const SCENE_INFRASTRUCTURE = [
  "/src/utils/functions/playcanvas/",
  "/src/features/playCanvasAdapter/",
  "/src/features/dividers/adapter/",
  "/src/entities/collection/model/runtimeBindings.ts",
];

/** Who removes a residue (B pages, C state and commands, I scene), and what it waits for (DEV-10). */
type Residue = { owner: "B" | "C" | "I"; reason: string };

/** A residue counted per file, so a file on the list cannot take a new call either. */
type CountedResidue = Residue & { count: number };

const countMatches = (source: string, patterns: RegExp[]) =>
  patterns.reduce((sum, pattern) => sum + (source.match(pattern)?.length ?? 0), 0);

/** Files with at least one match, and how many. */
const countByFile = (sources: [string, string][], patterns: RegExp[]) =>
  Object.fromEntries(
    sources.flatMap(([path, source]) => {
      const count = countMatches(source, patterns);
      return count > 0 ? [[path, count]] : [];
    }),
  );

const expectedCounts = (list: Record<string, CountedResidue>) =>
  Object.fromEntries(Object.entries(list).map(([path, { count }]) => [path, count]));

/**
 * Consumers that still call the scene directly, with who removes each call (C06).
 * The count is exact: a new call fails the test, and a removed one must lower the number,
 * so the list only shrinks (DEV-10).
 */
const PENDING_DIRECT_SCENE_CALLERS: Record<string, CountedResidue> = {
  "/src/widgets/CountertopSections/ui/CountertopSections.tsx": {
    owner: "B",
    count: 4,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useBasinState.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useVesselColorState.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useCountertopResets.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/AccessoriesSections/ui/AccessoriesSections.tsx": {
    owner: "B",
    count: 1,
    reason: "C06 phase 2: towel bar reset effect",
  },
  "/src/widgets/AccessoriesSections/lib/useDividersState.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 5: dividers None through the command",
  },
  "/src/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar.tsx": {
    owner: "B",
    count: 2,
    reason: "C06 phase 4: depth through changeDimension; phase 7: open shelves removed through removeCabinets",
  },
};

/** Action creators the command commits (commitChange.ts); anything else dispatching them is a second writer. */
const COMMITTED_SETTERS = [
  "commitRuleSelection",
  "setActiveCountertopThickness",
  "setActiveBasinStyle",
  "setActiveCountertopColor",
  "setBookMatching",
  "setCabinetColor",
  "setCabinetColorFinish",
  "setCabinetColorMaterial",
  "setCountertopStyle",
  "setDividersOption",
  "setDividersStyle",
  "setDrawerPanelFluting",
  "setFaucetHolesAmount",
  "setFaucetHolesSpacing",
  "setGrainDirection",
  "setHandleGrooveColor",
  "setLedOption",
  "setPlacedCabinetStyle",
  "setSidePanelSideStatus",
  "setSidePanelsOption",
  "setTowelBarColor",
  "setTowelBarOption",
  "setVesselColor",
];

const directStateWrites = [new RegExp(`\\bdispatch\\(\\s*(?:${COMMITTED_SETTERS.join("|")})\\(`, "g")];

/** The composition the scene holds is recorded by the composition commands alone (C06). */
const compositionWrites = [/\brecordComposition\s*\(/g];
const COMPOSITION_WRITE_OWNERS = [
  "/src/features/configurationCommands/lib/composition.ts",
  // The reducer itself.
  "/src/entities/product/model/store/slice.ts",
];

/** The command's own writer, and restore/undo that record a whole snapshot at once. */
const STATE_WRITE_OWNERS = ["/src/features/configurationCommands/lib/commitChange.ts"];

/**
 * Consumers that still write a value the command owns, next to the command or instead of it
 * (C06: one writer per value). Same exact-count rule as the scene callers.
 */
const PENDING_DIRECT_STATE_WRITERS: Record<string, CountedResidue> = {
  "/src/widgets/AccessoriesSections/lib/useDividersState.ts": {
    owner: "B",
    count: 3,
    reason: "C06 phase 5: dividers option and style through the command",
  },
  "/src/widgets/CountertopSections/ui/CountertopSections.tsx": {
    owner: "B",
    count: 5,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useBasinState.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useVesselColorState.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/widgets/CountertopSections/lib/useCountertopResets.ts": {
    owner: "B",
    count: 1,
    reason: "C06 phase 3: basin, vessel and countertop style through useCountertopCommands",
  },
  "/src/pages/custom/cabinetBuilder/CabinetBuilderPage.tsx": {
    owner: "C",
    count: 1,
    reason: "a saved divider style has no drawer to address: the profile keeps DividersStyle per drawer",
  },
  "/src/widgets/CabinetColorSections/ui/CabinetColorSections.tsx": {
    owner: "B",
    count: 3,
    reason: "C06 phase 7: the preset colour with its material and finish recorded by applyPreset",
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
  "/src/widgets/CountertopSections/lib/useBasinState.ts": {
    owner: "B",
    reason: "B06: basin rules of the countertop step",
  },
  "/src/widgets/CountertopSections/lib/basinOptions.ts": {
    owner: "B",
    reason: "B06: basin rules of the countertop step",
  },
  "/src/widgets/CountertopSections/lib/materialCompatibility.ts": {
    owner: "B",
    reason: "B06: material filters of the countertop step",
  },
  "/src/widgets/CountertopSections/lib/countertopColorOptions.ts": {
    owner: "B",
    reason: "B06: material filters of the countertop step",
  },
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
const PENDING_PAGE_CATALOGS: Record<string, { owner: "B"; constants: string[] }> = {};

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

  it("calls the scene directly only in the wrappers and, exactly as counted, in the files still waiting", () => {
    const callers = countByFile(
      productionSources.filter(([path]) => !SCENE_INFRASTRUCTURE.some((allowed) => path.startsWith(allowed))),
      directSceneCalls,
    );

    expect(callers).toEqual(expectedCounts(PENDING_DIRECT_SCENE_CALLERS));
  });

  it("writes a value the command owns only in the command and, exactly as counted, in the files still waiting", () => {
    const writers = countByFile(
      productionSources.filter(([path]) => !STATE_WRITE_OWNERS.includes(path)),
      directStateWrites,
    );

    expect(writers).toEqual(expectedCounts(PENDING_DIRECT_STATE_WRITERS));
  });

  it("records the composition only in the composition commands", () => {
    const writers = countByFile(
      productionSources.filter(([path]) => !COMPOSITION_WRITE_OWNERS.includes(path)),
      compositionWrites,
    );

    expect(writers).toEqual({});
  });

  it("counts every action creator the command commits", () => {
    const commitChange = sourceModules["/src/features/configurationCommands/lib/commitChange.ts"] ?? "";
    const imported =
      commitChange.match(/import \{([^}]*)\} from "@\/entities\/product\/model\/store\/slice"/)?.[1] ?? "";
    // Selection, preset and pricing inputs are not values the command alone owns.
    const notOwned = [
      "addProductPreset",
      "setSelectedProductConfig",
      "setSelectedDimensions",
      "setHandleGrooveColorSku",
    ];
    const committed = imported
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name && !notOwned.includes(name));

    expect([...committed].sort()).toEqual([...COMMITTED_SETTERS].sort());
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
