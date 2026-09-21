import type { ConfigurationRuntimePort } from "@/entities/configuration";

import { useChangeAttribute } from "./useChangeAttribute";

/** A dimension change through the same command service, flow and scene adapter as any field. */
export const useChangeDimension = ({ runtime }: { runtime?: ConfigurationRuntimePort } = {}) =>
  useChangeAttribute({ runtime }).changeDimension;
