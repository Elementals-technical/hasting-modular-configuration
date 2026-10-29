import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { ReadyCollectionContext, type ReadyCollectionData } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import type { CustomizationDrawerOrganizers } from "@/entities/collection/model/customizationSchema";
import type { DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";

import classManifest from "../../../../public/collections/class/manifest.json";
import classUi from "../../../../public/collections/class/ui.json";

import { withStore, type OrganizerTestStore } from "./organizerHookSetup";

/**
 * Helpers of the organizer component tests (panel, layer, accessories): the Class collection as a page sees
 * it, a window with a controllable `matchMedia`, and the read-model entry of a drawer. Test helper, not a test file.
 */

/** Class (it offers organizers), with the `drawerOrganizers` block of its `ui.json` changed as the test needs. */
export const classCollection = (organizerUi: Partial<CustomizationDrawerOrganizers> = {}): ReadyCollectionData => {
  const ui = structuredClone(classUi) as typeof classUi & { drawerOrganizers: CustomizationDrawerOrganizers };
  ui.drawerOrganizers = { ...ui.drawerOrganizers, ...organizerUi };
  return buildReadyCollection("class", classManifest, ui);
};

/** Store, router and the collection a page has; `children` may use `useActiveCollection` and the router. */
export const withPage =
  (store: OrganizerTestStore, collection: ReadyCollectionData = classCollection()) =>
  ({ children }: { children: ReactNode }) => {
    const WithStore = withStore(store);
    return (
      <ReadyCollectionContext.Provider value={collection}>
        <WithStore>
          <MemoryRouter>{children}</MemoryRouter>
        </WithStore>
      </ReadyCollectionContext.Provider>
    );
  };

/** Read-model entry of a cabinet whose drawers hold these columns (all Metal). */
export const columnsEntry = (drawers: {
  Top?: Array<{ slot: number; positions: number[] }>;
  Bot?: Array<{ slot: number; positions: number[] }>;
}): DrawerOrganizersRead => ({
  status: "ok",
  value: {
    version: 1,
    ...(drawers.Top ? { Top: { style: "Metal", columns: drawers.Top } } : {}),
    ...(drawers.Bot ? { Bot: { style: "Metal", columns: drawers.Bot } } : {}),
  },
});

export const MEDIA = {
  compact: "(max-width: 1024px)",
  short: "(max-height: 620px)",
  landscape: "(orientation: landscape)",
} as const;

/** A `window.matchMedia` that answers from a set of queries the test says match, and tells listeners when it changes. */
export const installMatchMedia = () => {
  const matching = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();

  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return matching.has(query);
    },
    addEventListener: (_event: string, listener: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)?.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => listeners.get(query)?.delete(listener),
  })) as unknown as typeof window.matchMedia;

  return {
    /** Sets which queries match; the listeners of a query whose answer changed are called. */
    match(...queries: string[]) {
      const before = new Set(matching);
      matching.clear();
      for (const query of queries) matching.add(query);
      for (const [query, set] of listeners) {
        if (before.has(query) !== matching.has(query)) for (const listener of [...set]) listener();
      }
    },
  };
};
