import lameRuntimeBindingsDocument from "../../../../../../public/collections/lame/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

/**
 * The production Lame runtime bindings, parsed once for tests.
 *
 * Tests read the very document the collection ships, so a change to it shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const lameRuntimeBindings: RuntimeBindingSet = (() => {
  const result = parseRuntimeBindings(lameRuntimeBindingsDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged Lame runtime bindings failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.bindings;
})();
