import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { handleRule } from "./handleRule";
import { typeCabinetRule } from "./typeCabinetRule";
import type { RuleContext, RuleResult } from "../model/types";

export const ruleCore = (catalog: ConfiguratorCatalog, context: RuleContext): RuleResult => {
  const baseResult = typeCabinetRule(catalog, context);
  return handleRule(baseResult, context, catalog);
};
