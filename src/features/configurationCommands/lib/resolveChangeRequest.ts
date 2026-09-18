import type { RootState } from "@/app/store";
import { selectAttribute } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import type { AttributeValue } from "@/entities/configuration";

import type { AttributeChange } from "../model/types";

/**
 * The change a field makes when the user picks a value, addressed at the scope its profile
 * attribute declares.
 *
 * A cabinet-scoped value that the pages apply to the whole composition (fluting, grain,
 * groove colour) names the first placed cabinet; the runtime binding decides which
 * products the scene updates. `null` when the attribute is unknown, a cabinet-scoped value
 * has no cabinet to name, or the value is addressed per drawer, which a field does not know.
 */
export const resolveChangeRequest = (
  state: RootState,
  attributeId: string,
  value: AttributeValue,
): AttributeChange | null => {
  const scope = selectAttribute(getActiveProductProfile(state), attributeId)?.scope;

  switch (scope) {
    case "global":
    case "countertop":
      return { attributeId, value, scope };

    case "basin": {
      const cabinets = getCabinetEntries(state);
      const sinkBaseId =
        cabinets.find(({ runtimeId }) => runtimeId.toLowerCase().includes("sink-base"))?.stableKey ??
        (state.rootStateUI.product.activeCabinetType?.toLowerCase().includes("sink-base") ? cabinets[0]?.stableKey : undefined);
      return sinkBaseId ? { attributeId, value, scope, sinkBaseId } : null;
    }

    case "cabinet": {
      const cabinetId = getCabinetEntries(state)[0]?.stableKey;
      return cabinetId ? { attributeId, value, scope, cabinetId } : null;
    }

    default:
      return null;
  }
};
