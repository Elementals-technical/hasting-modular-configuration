import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";

import type { CountertopMatrixRule } from "../types";

const EMPTY_COUNTERTOP_RULES: CountertopMatrixRule[] = [];

type UseCountertopRulesOptions = {
  skip?: boolean;
};

/**
 * Parsed countertop rules of the active collection.
 *
 * The table id used to be a constant here, which made every consumer depend on one
 * collection. It now comes with the collection, and the parsing happens once in the
 * loader, so a collection that is still resolving yields no rules rather than the rules
 * of the previous one.
 */
export const useCountertopRules = (options: UseCountertopRulesOptions = {}): CountertopMatrixRule[] => {
  const { skip = false } = options;
  const collection = useActiveCollection();

  const rules = collection.status === "ready" ? collection.data.catalog.countertops : undefined;

  return useMemo(() => {
    if (skip) return EMPTY_COUNTERTOP_RULES;
    return rules ?? EMPTY_COUNTERTOP_RULES;
  }, [rules, skip]);
};
