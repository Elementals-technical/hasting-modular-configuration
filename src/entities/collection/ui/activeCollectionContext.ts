import { createContext, useContext } from "react";

import type { ActiveCollectionState, ReadyCollectionData } from "../model/types";

export const ActiveCollectionContext = createContext<ActiveCollectionState | null>(null);
export const ReadyCollectionContext = createContext<ReadyCollectionData | null>(null);

/** @deprecated Product consumers migrate to the ready-only hook in the final integration slice. */
export const useActiveCollection = (): ActiveCollectionState => {
  return useActiveCollectionState();
};

export const useActiveCollectionState = (): ActiveCollectionState => {
  const state = useContext(ActiveCollectionContext);
  if (!state) throw new Error("useActiveCollectionState must be used within ActiveCollectionProvider");
  return state;
};

export function useReadyActiveCollection(): ReadyCollectionData;
export function useReadyActiveCollection<Selected>(selector: (collection: ReadyCollectionData) => Selected): Selected;
export function useReadyActiveCollection<Selected>(
  selector?: (collection: ReadyCollectionData) => Selected,
): ReadyCollectionData | Selected {
  const collection = useContext(ReadyCollectionContext);
  if (!collection) {
    throw new Error("useReadyActiveCollection must be used within CollectionReadinessGate");
  }

  return selector ? selector(collection) : collection;
}
