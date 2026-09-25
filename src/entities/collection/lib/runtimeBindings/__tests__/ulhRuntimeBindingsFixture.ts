import ulhRuntimeBindingsDocument from "../../../../../../public/collections/urban-low-height/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

/**
 * The production Urban Low Height runtime bindings, parsed once for tests.
 *
 * Tests read the very document the collection ships, so a change to it shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const ulhRuntimeBindings: RuntimeBindingSet = (() => {
  const result = parseRuntimeBindings(ulhRuntimeBindingsDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged Urban Low Height runtime bindings failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.bindings;
})();
