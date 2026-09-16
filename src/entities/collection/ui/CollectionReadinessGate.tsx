import type { ReactNode } from "react";

import { LoaderIcon } from "@/shared/assets/images/svg/LoaderIcon";

import { isReadyCollectionData } from "../model/types";
import { ReadyCollectionContext, useActiveCollectionState } from "./activeCollectionContext";

import s from "./CollectionReadinessGate.module.scss";

export type CollectionReadinessGateProps = {
  children: ReactNode;
};

const CollectionLoadingScreen = () => (
  <main className={s.screen} aria-busy="true" aria-live="polite">
    <span className={s.spinner} aria-hidden="true">
      <LoaderIcon />
    </span>
    <p className={s.message}>Loading collection…</p>
  </main>
);

export const CollectionReadinessGate = ({ children }: CollectionReadinessGateProps) => {
  const state = useActiveCollectionState();

  if (state.status === "resolving" || state.status === "loading") {
    return <CollectionLoadingScreen />;
  }

  // Recovery UI and capability-specific error copy arrive in the next slice. Keeping
  // the shell unmounted here is the safety property this boundary must establish first.
  if (state.status === "error" || !isReadyCollectionData(state.data)) {
    return null;
  }

  return <ReadyCollectionContext.Provider value={state.data}>{children}</ReadyCollectionContext.Provider>;
};
