import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import { typeCabinetRule } from "./typeCabinetRule";
import type { RuleContext, RuleResult } from "../model/types";

export const ruleCore = (catalog: ConfiguratorCatalog, context: RuleContext): RuleResult => {
  return typeCabinetRule(catalog, context);
};
