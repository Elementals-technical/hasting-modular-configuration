import ushRuntimeBindingsDocument from "../../../../../../public/collections/urban-standard-height/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

/**
 * The production USH runtime bindings, parsed once for tests.
 *
 * Tests read the very document the collection ships, so a change to it shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const ushRuntimeBindings: RuntimeBindingSet = (() => {
  const result = parseRuntimeBindings(ushRuntimeBindingsDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged USH runtime bindings failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.bindings;
})();
