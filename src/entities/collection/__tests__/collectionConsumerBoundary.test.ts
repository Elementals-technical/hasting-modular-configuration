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
});
