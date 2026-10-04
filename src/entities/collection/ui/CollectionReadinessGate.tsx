import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { LoaderIcon } from "@/shared/assets/images/svg/LoaderIcon";
import { BaseButton } from "@/shared/ui";

import { isReadyCollectionData } from "../model/types";
import {
  ReadyCollectionContext,
  useActiveCollectionSession,
  useActiveCollectionState,
} from "./activeCollectionContext";
import { removeCollectionIdFromUrl } from "./collectionRecoveryUrl";

import s from "./CollectionReadinessGate.module.scss";

export type CollectionReadinessGateProps = {
  children: ReactNode;
  navigateTo?: (url: string) => void;
};

type ErrorScreenProps = {
  collectionId?: string;
  description: string;
  onRetry: () => void;
  onOpenDefault?: () => void;
};

const CollectionLoadingScreen = () => (
  <main className={s.screen} aria-busy="true" aria-live="polite">
    <span className={s.spinner} aria-hidden="true">
      <LoaderIcon />
    </span>
    <p className={s.message}>Loading collection…</p>
  </main>
);

const CollectionErrorScreen = ({ collectionId, description, onRetry, onOpenDefault }: ErrorScreenProps) => (
  <main className={s.screen} role="alert">
    <div className={s.errorCard}>
      <h1 className={s.title}>Collection unavailable</h1>
      <p className={s.message}>{description}</p>
      {collectionId && <p className={s.collectionId}>Collection: {collectionId}</p>}
      <div className={s.actions}>
        <BaseButton type="button" onClick={onRetry}>
          Retry
        </BaseButton>
        {onOpenDefault && (
          <BaseButton type="button" variant="secondary" onClick={onOpenDefault}>
            Open default collection
          </BaseButton>
        )}
      </div>
    </div>
  </main>
);

const SessionIdentityErrorScreen = ({ onRestart }: { onRestart: () => void }) => (
  <main className={s.screen} role="alert">
    <div className={s.errorCard}>
      <h1 className={s.title}>Restart required</h1>
      <p className={s.message}>Collection cannot be changed during an active configurator session.</p>
      <div className={s.actions}>
        <BaseButton type="button" onClick={onRestart}>
          Restart configurator
        </BaseButton>
      </div>
    </div>
  </main>
);

const errorDescription = (code: string): string => {
  if (code === "unknown-collection") return "The requested collection was not found.";
  if (code === "invalid-collection-id") return "The collection link is invalid.";
  if (code === "invalid-registry") return "The collection registry could not be loaded.";
  if (code === "invalid-manifest" || code === "source-validation-failed") {
    return "The collection data is invalid and the configurator cannot start.";
  }
  return "The collection data could not be loaded. Please try again.";
};

export const CollectionReadinessGate = ({
  children,
  navigateTo = (url) => window.location.assign(url),
}: CollectionReadinessGateProps) => {
  const state = useActiveCollectionState();
  const session = useActiveCollectionSession();
  const location = useLocation();
  const currentCollectionId = new URLSearchParams(location.search).get("collectionId");
  const currentUrl = new URL(location.pathname + location.search + location.hash, window.location.origin).toString();

  if (currentCollectionId !== session.requestedCollectionId) {
    return <SessionIdentityErrorScreen onRestart={() => navigateTo(currentUrl)} />;
  }

  if (state.status === "resolving" || state.status === "loading") {
    return <CollectionLoadingScreen />;
  }

  const requestedId = session.requestedCollectionId ?? state.collectionId;
  const canOpenDefault =
    session.requestedCollectionId !== null &&
    session.defaultCollectionId !== undefined &&
    session.requestedCollectionId !== session.defaultCollectionId;
  const openDefault = canOpenDefault ? () => navigateTo(removeCollectionIdFromUrl(currentUrl)) : undefined;

  if (state.status === "error") {
    return (
      <CollectionErrorScreen
        collectionId={requestedId}
        description={errorDescription(state.error.code)}
        onRetry={session.retry}
        onOpenDefault={openDefault}
      />
    );
  }

  if (!isReadyCollectionData(state.data)) {
    return (
      <CollectionErrorScreen
        collectionId={state.data.id}
        description="This collection does not provide the configurator data required to start."
        onRetry={session.retry}
        onOpenDefault={openDefault}
      />
    );
  }

  return <ReadyCollectionContext.Provider value={state.data}>{children}</ReadyCollectionContext.Provider>;
};
