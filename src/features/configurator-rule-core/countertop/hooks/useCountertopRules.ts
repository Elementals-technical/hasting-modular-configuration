import { useMemo } from "react";

import { useGetCountertopDatatableQuery } from "@/entities/countertop";

import { parseCountertopMatrix } from "../parse";
import type { CountertopMatrixRule } from "../types";

const COUNTERTOP_MATRIX_DATATABLE_ID = 438;

/**
 * Single source for parsed countertop rules. RTK Query dedupes the underlying
 * fetch across consumers, and useMemo keeps a stable array reference.
 */
export const useCountertopRules = (): CountertopMatrixRule[] => {
  const { data } = useGetCountertopDatatableQuery(COUNTERTOP_MATRIX_DATATABLE_ID);
  return useMemo(() => parseCountertopMatrix(data), [data]);
};
