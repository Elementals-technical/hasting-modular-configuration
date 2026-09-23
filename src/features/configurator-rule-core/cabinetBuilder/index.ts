import type { ProductProfile } from "@/entities/collection";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { autoChange } from "./lib/autoChange";
export { getUniqueCatalogWidths } from "./lib/catalogDimensions";
export { buildHandleStyleConfigPatch } from "./lib/handleStyleConfig";
export { REASON_HANDLE_HEIGHT_LOCKED } from "./lib/handleRule";
import { ruleCore } from "./lib/ruleCore";
import type { Intent, RuleContext } from "./model/types";
import type { RuleResult, AutoChangeResult, Selection } from "./model/types";

export type { Selection, Intent, OptionState, AvailableOptions } from "./model/types";

type ApplyRulesResult = RuleResult & AutoChangeResult;

/**
 * `catalog` and `profile` are required arguments on purpose.
 *
 * They used to default to the empty packaged catalog, which silently allowed every
 * value when no source had been loaded. A missing source must be visible to the caller,
 * not turned into a permissive result.
 */
export const applyConfiguratorRules = (
  selection: Selection,
  intent: Intent | undefined,
  extraContext: Omit<RuleContext, "selection"> | undefined,
  catalog: ConfiguratorCatalog,
  profile: ProductProfile | null,
): ApplyRulesResult => {
  const context: RuleContext = {
    selection: { ...selection, width: Number(selection.width) },
    ...extraContext,
  };

  // Placeholder for intent-aware rules in future; currently we rely on the context only.
  void intent;

  const rulesResult = ruleCore(catalog, context, profile);
  const autoChangeResult = autoChange(rulesResult, context);

  return {
    ...rulesResult,
    ...autoChangeResult,
  };
};
