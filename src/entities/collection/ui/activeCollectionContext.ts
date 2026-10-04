import { createContext, useContext } from "react";

import type { ActiveCollectionState, ReadyCollectionData } from "../model/types";

export const ActiveCollectionContext = createContext<ActiveCollectionState | null>(null);
export const ReadyCollectionContext = createContext<ReadyCollectionData | null>(null);

export type ActiveCollectionSession = {
  requestedCollectionId: string | null;
  defaultCollectionId?: string;
  retry: () => void;
};

export const ActiveCollectionSessionContext = createContext<ActiveCollectionSession | null>(null);

export const useActiveCollectionState = (): ActiveCollectionState => {
  const state = useContext(ActiveCollectionContext);
  if (!state) throw new Error("useActiveCollectionState must be used within ActiveCollectionProvider");
  return state;
};

export const useActiveCollectionSession = (): ActiveCollectionSession => {
  const session = useContext(ActiveCollectionSessionContext);
  if (!session) throw new Error("useActiveCollectionSession must be used within ActiveCollectionProvider");
  return session;
};

export function useActiveCollection(): ReadyCollectionData;
export function useActiveCollection<Selected>(selector: (collection: ReadyCollectionData) => Selected): Selected;
export function useActiveCollection<Selected>(
  selector?: (collection: ReadyCollectionData) => Selected,
): ReadyCollectionData | Selected {
  const collection = useContext(ReadyCollectionContext);
  if (!collection) {
    throw new Error("useActiveCollection must be used within CollectionReadinessGate");
  }

  return selector ? selector(collection) : collection;
}
