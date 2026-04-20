import { typeCabinetCatalog, type ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { autoChange } from "./lib/autoChange";
export { buildHandleStyleConfigPatch } from "./lib/handleStyleConfig";
import { ruleCore } from "./lib/ruleCore";
import type { Intent, RuleContext } from "./model/types";
import type { RuleResult, AutoChangeResult, Selection } from "./model/types";

export type { Selection, Intent, OptionState, AvailableOptions } from "./model/types";

type ApplyRulesResult = RuleResult & AutoChangeResult;

export const applyConfiguratorRules = (
  selection: Selection,
  intent?: Intent,
  extraContext?: Omit<RuleContext, "selection">,
  catalog: ConfiguratorCatalog = typeCabinetCatalog,
): ApplyRulesResult => {
  const context: RuleContext = {
    selection: { ...selection, width: Number(selection.width) },
    ...extraContext,
  };

  // Placeholder for intent-aware rules in future; currently we rely on the context only.
  void intent;

  const rulesResult = ruleCore(catalog, context);
  const autoChangeResult = autoChange(rulesResult, context);

  return {
    ...rulesResult,
    ...autoChangeResult,
  };
};
