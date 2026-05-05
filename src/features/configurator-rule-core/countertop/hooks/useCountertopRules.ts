import { useMemo } from "react";

import { useGetCountertopDatatableQuery } from "@/entities/countertop";

import { parseCountertopMatrix } from "../parse";
import type { CountertopMatrixRule } from "../types";

const COUNTERTOP_MATRIX_DATATABLE_ID = 438;
const EMPTY_COUNTERTOP_RULES: CountertopMatrixRule[] = [];

type UseCountertopRulesOptions = {
  skip?: boolean;
};

/**
 * Single source for parsed countertop rules. RTK Query dedupes the underlying
 * fetch across consumers, and useMemo keeps a stable array reference.
 */
export const useCountertopRules = (options: UseCountertopRulesOptions = {}): CountertopMatrixRule[] => {
  const { skip = false } = options;
  const { data } = useGetCountertopDatatableQuery(COUNTERTOP_MATRIX_DATATABLE_ID, { skip });

  return useMemo(() => {
    if (skip) return EMPTY_COUNTERTOP_RULES;
    return parseCountertopMatrix(data);
  }, [data, skip]);
};
