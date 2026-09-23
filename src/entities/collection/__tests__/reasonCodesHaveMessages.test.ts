import { describe, expect, it } from "vitest";

import { ushProfile } from "./ushProfileFixture";
import { parseProductProfile } from "../lib/parseProductProfile";
import { selectMessage } from "../lib/productProfileSelectors";

/**
 * DEV-08: rules and commands return a reason code, and the text comes from the collection's
 * `messages`. A code without a text reaches the user as the bare code, so every code the
 * production code can return must have a text in the USH profile.
 */

const sourceModules = import.meta.glob("/src/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const productionSources = Object.entries(sourceModules).filter(
  ([path]) => !path.includes("/__tests__/") && !path.includes(".test."),
);

/** Modules whose results carry reason codes: every `"namespace.camelCase"` literal there is one. */
const REASON_SOURCES = [
  "/src/features/configurator-rule-core/",
  "/src/features/configurationCommands/",
  "/src/features/sidePanel/",
  "/src/features/dividers/",
  "/src/shared/lib/bookMatching/",
];

const reasonLiteral = /"([a-z][a-zA-Z]*\.[a-z][a-zA-Z]*)"/g;
/** Pages declare the codes they show as `REASON_…` constants. */
const reasonConstant = /\bREASON_[A-Z_]+\s*=\s*"([a-z][a-zA-Z]*\.[a-z][a-zA-Z]*)"/g;

const reasonCodes = [
  ...new Set(
    productionSources.flatMap(([path, source]) => {
      const pattern = REASON_SOURCES.some((prefix) => path.startsWith(prefix)) ? reasonLiteral : reasonConstant;
      return [...source.matchAll(pattern)].map(([, code]) => code);
    }),
  ),
].sort();

describe("reason codes have a text in the USH profile", () => {
  it("finds the codes of rules, commands and pages", () => {
    expect(reasonCodes).toEqual(
      expect.arrayContaining([
        "change.valueNotInCatalog",
        "handle.requiredHeight",
        "sidePanel.notInCollection",
        "countertop.materialNotAvailableForDepth",
      ]),
    );
  });

  it("declares a message for every code", () => {
    expect(reasonCodes.filter((code) => selectMessage(ushProfile, code) === code)).toEqual([]);
  });
});

/**
 * Codes the command returns whatever the collection: a value outside the catalog, an option the
 * current selection rules out. Every production collection reaches them, so each needs a text.
 */
const commandCodes = reasonCodes.filter((code) => code.startsWith("change."));

const productionProfiles = Object.entries(
  import.meta.glob("/public/collections/*/product-profile.json", { eager: true, import: "default" }),
).map(([path, document]) => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(`${path} failed validation`);
  return result.profile;
});

describe("command reason codes have a text in every production collection", () => {
  it("reads every production profile", () => {
    expect(productionProfiles.map(({ collectionId }) => collectionId).sort()).toEqual([
      "class",
      "mako",
      "urban-low-height",
      "urban-standard-height",
    ]);
    expect(commandCodes).toEqual(expect.arrayContaining(["change.notAvailable", "change.valueNotInCatalog"]));
  });

  it.each(productionProfiles.map((profile) => [profile.collectionId, profile] as const))(
    "%s declares a message for every command code",
    (_, profile) => {
      expect(commandCodes.filter((code) => selectMessage(profile, code) === code)).toEqual([]);
    },
  );
});
