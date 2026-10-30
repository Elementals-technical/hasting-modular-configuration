import makoRuntimeBindingsDocument from "../../../../../../public/collections/mako/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";
import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

/**
 * The production Mako runtime bindings, parsed once for tests.
 *
 * Tests read the very document the collection ships, so a change to it shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const makoRuntimeBindings: RuntimeBindingSet = (() => {
  const result = parseRuntimeBindings(makoRuntimeBindingsDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged Mako runtime bindings failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return result.bindings;
})();
