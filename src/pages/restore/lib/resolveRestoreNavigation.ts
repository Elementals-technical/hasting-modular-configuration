export type RestoreNavigation = { kind: "client" } | { kind: "reload" };

export type RestoreNavigationInput = {
  /** Collection the session started with, as the current URL spells it. */
  sessionCollectionId: string | null;
  /** Collection the saved configuration belongs to, or null when it names none. */
  savedCollectionId: string | null;
};

/**
 * How to open a restored configuration.
 *
 * The collection of a session is fixed when the app starts: client navigation that adds,
 * removes or changes `collectionId` is blocked as identity drift (CollectionReadinessGate).
 * A restore link usually carries no collection, so restoring into another one is the start
 * of a session rather than a change inside it, and needs a real page load.
 */
export const resolveRestoreNavigation = ({
  sessionCollectionId,
  savedCollectionId,
}: RestoreNavigationInput): RestoreNavigation => {
  const session = sessionCollectionId?.trim() ? sessionCollectionId.trim() : null;
  const saved = savedCollectionId?.trim() ? savedCollectionId.trim() : null;

  // Without a saved collection the restore keeps the session as it is, default included.
  if (!saved) return { kind: "client" };

  return saved === session ? { kind: "client" } : { kind: "reload" };
};
