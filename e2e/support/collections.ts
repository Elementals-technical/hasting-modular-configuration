import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Collections under test: the UI page of each (its builder, without a saved configuration) and its fixtures folder
 * e2e/fixtures/<key>/. A fixture is a compact preset exported from the scene
 * (ConfiguratorAPI.composition.exportCompactPreset) and loaded with importCompactPreset: no saved configuration
 * on the backend is needed, and the fixture is reviewed with the test.
 */
export const COLLECTIONS = {
  ulh: { collectionId: "urban-low-height", builderPath: "/custom/cabinet-builder" },
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** e2e/fixtures/<collection>/<name>.json */
export function readPreset(collection: CollectionKey, name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES, collection, `${name}.json`), "utf8"));
}
