import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { typeCabinetRule } from "./typeCabinetRule";
import { handleRule } from "./handleRule";
import type { RuleContext, RuleResult } from "../model/types";

export const ruleCore = (catalog: ConfiguratorCatalog, context: RuleContext): RuleResult => {
  const typeRules = typeCabinetRule(catalog, context);
  return handleRule(typeRules, context);
};
