import { useSyncExternalStore } from "react";

import {
  getCountertopRuntimeSize,
  subscribeCountertopRuntimeSize,
  type CountertopRuntimeSize,
} from "@/shared/lib/countertopRuntimeSize";

export const useCountertopRuntimeSize = (): CountertopRuntimeSize | null =>
  useSyncExternalStore(subscribeCountertopRuntimeSize, getCountertopRuntimeSize, getCountertopRuntimeSize);
