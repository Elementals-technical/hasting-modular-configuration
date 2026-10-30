import { describe, expect, it } from "vitest";

import { UI_REASON_TEXTS } from "../uiReasonTexts";

/**
 * DEV-08: interface components name a reason code and let the resolver find the text. A code a
 * component falls back to must have a text here, or the user reads the bare code; and no
 * component may keep a phrase of its own again.
 */

const sourceModules = import.meta.glob("/src/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const productionSources = Object.entries(sourceModules).filter(
  ([path]) => !path.includes("/__tests__/") && !path.includes(".test."),
);

/** Files that resolve a code themselves: the codes they spell are their own fallbacks. */
const resolvingComponents = productionSources.filter(([, source]) => source.includes("useReasonText("));

const reasonCodeConstant = /\b[A-Z][A-Z_]*_REASON_CODE\s*=\s*"([a-z][a-zA-Z]*\.[a-z][a-zA-Z]*)"/g;

/** Wording that used to sit in the components; the dictionary and the collections own it now. */
const formerComponentTexts = [/"Not available for selected configuration"/, /"Not available\."/, /Cannot mix 1 Drawer/];

const INTERFACE_SOURCES = ["/src/shared/ui/", "/src/widgets/"];

describe("codes the interface falls back to", () => {
  it("are declared by more than one component", () => {
    expect(resolvingComponents.length).toBeGreaterThan(1);
  });

  it("have a text in the dictionary", () => {
    const missing = resolvingComponents.flatMap(([path, source]) =>
      [...source.matchAll(reasonCodeConstant)]
        .map(([, code]) => code)
        .filter((code) => !(code in UI_REASON_TEXTS))
        .map((code) => `${path}: ${code}`),
    );

    expect(missing).toEqual([]);
  });
});

describe("interface components", () => {
  it("keep no reason wording of their own", () => {
    const offenders = productionSources
      .filter(([path]) => INTERFACE_SOURCES.some((prefix) => path.startsWith(prefix)))
      .flatMap(([path, source]) =>
        formerComponentTexts.filter((pattern) => pattern.test(source)).map((pattern) => `${path}: ${pattern.source}`),
      );

    expect(offenders).toEqual([]);
  });
});
