import classRuntimeBindingsDocument from "../../../../../../public/collections/class/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

/**
 * The production Class runtime bindings, parsed once for tests.
 *
 * Tests read the very document the collection ships, so a change to it shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const classRuntimeBindings: RuntimeBindingSet = (() => {
  const result = parseRuntimeBindings(classRuntimeBindingsDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged Class runtime bindings failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.bindings;
})();
