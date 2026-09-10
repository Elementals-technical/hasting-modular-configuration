import { createContext, useContext } from "react";

import type { ActiveCollectionState } from "../model/types";

export const ActiveCollectionContext = createContext<ActiveCollectionState | null>(null);

export const useActiveCollection = (): ActiveCollectionState => {
  const state = useContext(ActiveCollectionContext);
  if (!state) throw new Error("useActiveCollection must be used within ActiveCollectionProvider");
  return state;
};
