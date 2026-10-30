import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { recordOrganizers } from "@/entities/configuration";
import type {
  Correction,
  DrawerOrganizersRead,
  OrganizersState,
} from "@/entities/configuration/model/drawerOrganizers";
import {
  getOrganizersByCabinet,
  getRestoreState,
  getStableKeyForRuntimeId,
} from "@/entities/configuration/model/store/selectors";
import { getIsDrawerOpen } from "@/entities/product/model/store/selectors";
import { setIsDrawerOpen } from "@/entities/product/model/store/slice";
import { readModelEntryOf, type ConfiguratorUnsubscribe, type OrganizersChange } from "@/features/configuratorApi";
import { createOrganizerPort, type OrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { messageKeyForCorrection, ORGANIZER_MESSAGE_KEYS } from "../model/messages";
import { selectOrganizerInputKeys, selectOrganizersEnabled, selectOrganizersUi } from "../model/store/selectors";
import { pulseSave, recordDerived, selectColumn, setView, showNotice } from "../model/store/slice";
import { organizerOverlayStore, type OrganizerOverlayStore } from "./organizerOverlayStore";
import { useOrganizerEditor } from "./useOrganizerEditor";

/**
 * The one point where the UI listens to the organizers of the scene (mounted once, next to the canvas).
 * It keeps the read-model and the derived state up to date from `change`, mirrors the drawer in view into
 * `isDrawerOpen`, hands frames to the overlay store, turns a background tap into the C1 transition, reads
 * a product again when its size or drawers change (3D sends no `change` when every column stays), reads
 * every product again after a restore and when the section opens, and writes the draft when the section
 * closes. Collections without organizers (USH and the others) subscribe to nothing and read nothing.
 */

export type OrganizerRuntimeOptions = {
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  port?: OrganizerPort;
  overlay?: OrganizerOverlayStore;
};

/** Size, drawer and type changes the user did not make in the panel: dropped columns are told (Q-K6). */
const NOTICE_REASONS: ReadonlySet<OrganizersChange["reason"]> = new Set([
  "width",
  "height",
  "drawers",
  "config",
  "created",
]);

/**
 * How many columns a set of dropped corrections removed: one per correction with a slot; a drawer-wide
 * one (a drawer that went away) removed all of that drawer's columns, as recorded before.
 */
const droppedColumnCount = (dropped: readonly Correction[], before: DrawerOrganizersRead | undefined) =>
  dropped.reduce((count, { slot, drawer }) => {
    if (slot !== undefined || !drawer || before?.status !== "ok") return count + 1;
    return count + Math.max(before.value[drawer]?.columns.length ?? 0, 1);
  }, 0);

export const useOrganizerRuntime = (
  ready: boolean,
  { port: portOverride, overlay = organizerOverlayStore }: OrganizerRuntimeOptions = {},
): void => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectOrganizersEnabled);
  const port = useMemo(() => portOverride ?? createOrganizerPort(), [portOverride]);
  const editor = useOrganizerEditor({ port });
  const active = ready && enabled;

  /** Records what the scene holds for one product; null when the product has no stable key (yet). */
  const recordState = useMemo(
    () =>
      (state: OrganizersState, corrections: readonly Correction[] = []): string | null => {
        const stableKey = getStableKeyForRuntimeId(store.getState(), state.productId);
        if (!stableKey) {
          console.info("[drawerOrganizers] state of a product without a stable key", state.productId);
          return null;
        }
        dispatch(recordOrganizers({ stableKey, entry: readModelEntryOf(state, corrections) }));
        dispatch(recordDerived({ cabinetKey: stableKey, drawers: state.drawers }));
        return stableKey;
      },
    [dispatch, store],
  );

  // Subscriptions: one set while the scene is ready and the collection has organizers.
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const unsubscribes: ConfiguratorUnsubscribe[] = [];
    const keep = (unsubscribe: ConfiguratorUnsubscribe | null) => {
      if (!unsubscribe) return;
      if (disposed) unsubscribe();
      else unsubscribes.push(unsubscribe);
    };

    const onChange = (change: OrganizersChange) => {
      const stableKey = getStableKeyForRuntimeId(store.getState(), change.productId);
      const before = stableKey ? getOrganizersByCabinet(store.getState())[stableKey] : undefined;
      if (!recordState({ ...change.state, productId: change.productId }, change.corrections)) return;

      if (change.reason === "restore") {
        console.info("[drawerOrganizers] restored with corrections", change.productId, change.corrections);
        return;
      }
      if (!NOTICE_REASONS.has(change.reason)) return;

      const dropped = change.corrections.filter(({ severity }) => severity === "dropped");
      const key = dropped.map(({ code }) => messageKeyForCorrection(code)).find((messageKey) => messageKey !== null);
      if (key) {
        const told = dropped.filter(({ code }) => messageKeyForCorrection(code) === key);
        dispatch(showNotice({ key, params: { n: droppedColumnCount(told, before) }, undoHint: true }));
        return;
      }
      if (dropped.length > 0) {
        console.info("[drawerOrganizers] columns dropped without a message", change.corrections);
        return;
      }
      // SB <-> SC replaces the product without carrying the key (Q-O5, MVP): its columns are gone silently.
      const after = getOrganizersByCabinet(store.getState())[stableKey!];
      if (before?.status === "ok" && after === undefined) {
        dispatch(showNotice({ key: ORGANIZER_MESSAGE_KEYS.typeChanged, undoHint: true }));
      }
    };

    void port.onChange(onChange).then(keep);
    void port
      .onView(({ view }) => {
        const state = store.getState();
        const cabinetKey = view ? getStableKeyForRuntimeId(state, view.productId) : null;
        if (view && !cabinetKey) console.info("[drawerOrganizers] view of a product without a stable key", view);
        const address = view && cabinetKey ? { cabinetKey, drawer: view.drawer } : null;

        dispatch(setView(address));
        if (getIsDrawerOpen(store.getState()) !== Boolean(address)) dispatch(setIsDrawerOpen(Boolean(address)));
      })
      .then(keep);
    void port.onFrame((frame) => overlay.set(frame)).then(keep);
    void port
      .onPointer(() => {
        const { panel } = selectOrganizersUi(store.getState());
        if (panel === "presets") dispatch(selectColumn(null));
        else if (panel === "editor") dispatch(pulseSave());
      })
      .then(keep);

    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
      overlay.set(null);
    };
  }, [active, dispatch, overlay, port, recordState, store]);

  /** Reads every product of the scene once and records it (the same path as a single `getState`). */
  const readAllProducts = useCallback(async () => {
    const states = await port.list();
    for (const state of states ?? []) recordState(state);
  }, [port, recordState]);

  // Read-back of single products. Two cases need it, and both leave the scene without a `change`:
  //  - a product gets its stable key after 3D may already have sent its `change{created}` (logged above, not
  //    recorded), so a cabinet added with ⊕ would show as having no drawer to edit;
  //  - a size or drawer change that drops no column (SC 60 -> 120 with a full Bot, 1D -> 2D) leaves the
  //    capacity, the drawer's existence and `unavailable` in `derived` out of date.
  // Each product is read when it first appears and again whenever its input key changes
  // (`selectOrganizerInputKeys`); an unchanged key costs no call. Ids that left are forgotten, so a
  // returning id is read again.
  const inputKeys = useAppSelector(selectOrganizerInputKeys);
  const readInputKeys = useRef(new Map<string, string>());
  useEffect(() => {
    const readKeys = readInputKeys.current;
    if (!active) {
      // Not listening (scene not ready, or a collection without organizers): forget, so the next start reads all.
      readKeys.clear();
      return;
    }
    for (const runtimeId of readKeys.keys()) if (!Object.hasOwn(inputKeys, runtimeId)) readKeys.delete(runtimeId);

    for (const [runtimeId, inputKey] of Object.entries(inputKeys)) {
      // Same inputs as at the last read: 3D holds nothing new for this product, so no call.
      if (readKeys.get(runtimeId) === inputKey) continue;
      readKeys.set(runtimeId, inputKey);
      void port.getState(runtimeId).then((state) => {
        if (state) recordState(state);
      });
    }
  }, [active, inputKeys, port, recordState]);

  // After a saved configuration comes back, every product is read again from the scene.
  const restoreStatus = useAppSelector((state) => getRestoreState(state).status);
  const previousRestoreStatus = useRef(restoreStatus);
  useEffect(() => {
    const previous = previousRestoreStatus.current;
    previousRestoreStatus.current = restoreStatus;
    if (!active || previous !== "restoring" || (restoreStatus !== "restored" && restoreStatus !== "partial")) return;

    void readAllProducts();
  }, [active, readAllProducts, restoreStatus]);

  // The section opening and closing (the Drawer Dividers accordion, another accordion, Next).
  const sectionActive = useAppSelector((state) => selectOrganizersUi(state).sectionActive);
  const previousSectionActive = useRef(sectionActive);
  useEffect(() => {
    const previous = previousSectionActive.current;
    previousSectionActive.current = sectionActive;

    // 1. Opened: every product is read once more, a safety net for what the single reads above could not see.
    const opened = !previous && sectionActive;
    if (active && opened) void readAllProducts();

    // 2. Closed: an implicit exit, so a changed draft is written (T3, T23).
    const closed = previous && !sectionActive;
    if (closed) void editor.leave();
  }, [active, editor, readAllProducts, sectionActive]);
};
