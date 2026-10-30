import { useMemo } from "react";
import { useStore } from "react-redux";

import type { AppDispatch, RootState } from "@/app/store";
import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import { getCabinetByStableKey } from "@/entities/configuration/model/store/selectors";
import { isApplied, useHistoryStep, type HistoryStep } from "@/entities/history/lib/useHistoryStep";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import type { OrganizersViewInsets } from "@/features/configuratorApi";
import {
  changeDrawerOrganizers,
  type OrganizerChange,
  type OrganizerChangeResult,
} from "@/features/configurationCommands/lib/changeDrawerOrganizers";
import { createOrganizerPort, type OrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { messageKeyForError, ORGANIZER_MESSAGE_KEYS } from "../model/messages";
import { togglePosition } from "../model/positionsEditor";
import { selectOrganizerRules, selectOrganizerSet, selectOrganizersUi } from "../model/store/selectors";
import {
  backToPresets,
  openEditor as openEditorAction,
  pulseSave,
  selectColumn as selectColumnAction,
  setBusy,
  setDraft,
  setPendingStyle,
  showNotice,
} from "../model/store/slice";
import { organizerDrawerKey, type ColumnAddress, type OrganizerAddress } from "../model/types";

/**
 * The user's actions on the organizers of the drawer in view (C1 §1.3). Every change of the scene goes
 * through `changeDrawerOrganizers` inside one history step that is written only for an applied answer;
 * the editor draft is a preview and reaches the history only on Save or an implicit exit (Q-D6).
 *
 * One command at a time for every control: the gate is `drawerOrganizersUi.busy`, read synchronously from
 * the store, so a double click (or a click on another control) while a command runs does nothing.
 */

export type OrganizerEditor = {
  /** ⊕: a new empty column, not selected (I-1); it takes the drawer's chosen style. */
  addColumn(slot: number): Promise<void>;
  /** Selects a column of the drawer in view (null clears it); in the editor it only pulses Save (T10). */
  selectColumn(slot: number | null): void;
  /** A preset card: one step; the column stays selected and the list stays open, so presets can be compared. */
  applyPreset(presetId: string): Promise<void>;
  /** "Customize" card: the editor opens on the column's positions. */
  openEditor(): void;
  /** A position button of the editor: a preview only. `blocked` when the column already holds the most. */
  toggle(position: number): { blocked: boolean };
  /** Writes the draft as one step and returns to the preset list, the column still selected. */
  save(): Promise<void>;
  /** Drops the draft (no step) and returns to the presets. */
  back(): void;
  remove(): Promise<void>;
  /** The drawer's style: a command for a drawer with columns, otherwise kept for its first column. */
  setStyle(style: string): Promise<void>;
  openDrawer(address: OrganizerAddress): Promise<void>;
  /** Close Drawer: a changed draft is written as one step first. */
  closeDrawer(): Promise<void>;
  /** The other drawer of the cabinet in view. */
  switchDrawer(drawer: DrawerName): Promise<void>;
  /** An implicit exit (another section, Next): like Close Drawer, when a drawer is in view. */
  leave(): Promise<void>;
  setViewInsets(insets: OrganizersViewInsets): void;
};

export type OrganizerEditorOptions = {
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  port?: OrganizerPort;
};

type Store = { getState: () => RootState };

/** The positions of a column as the scene holds them, or null when the column is not there. */
const positionsOf = (state: RootState, column: ColumnAddress): number[] | null =>
  selectOrganizerSet(state, column)?.columns.find(({ slot }) => slot === column.slot)?.positions ?? null;

const samePositions = (a: readonly number[], b: readonly number[] | null) =>
  b !== null && [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();

/** The address of a column as the commands name it: the cabinet key becomes `cabinetId`. */
const columnTargetOf = ({ cabinetKey, drawer, slot }: ColumnAddress) => ({ cabinetId: cabinetKey, drawer, slot });

const runtimeIdOf = (state: RootState, cabinetKey: string) =>
  getCabinetByStableKey(state, cabinetKey)?.runtimeId ?? null;

/**
 * Runs one organizer task under the shared busy flag. Null when another one is running: the click is
 * dropped, never queued. A refusal or an error tells the user why (no undo hint: nothing changed).
 */
export const runOrganizerTask = async (
  store: Store,
  dispatch: AppDispatch,
  task: () => Promise<OrganizerChangeResult>,
): Promise<OrganizerChangeResult | null> => {
  if (selectOrganizersUi(store.getState()).busy) return null;
  dispatch(setBusy(true));
  try {
    const result = await task();
    if (result.status === "rejected" || result.status === "error") {
      dispatch(showNotice({ key: messageKeyForError(result.code), undoHint: false }));
    }
    return result;
  } catch (error) {
    console.error("[drawerOrganizers] command failed", error);
    dispatch(showNotice({ key: messageKeyForError("runtime-failed"), undoHint: false }));
    return null;
  } finally {
    dispatch(setBusy(false));
  }
};

/** One organizer command as one history step, written only when the scene took it (`isApplied`). */
export const runOrganizerStep = (
  store: Store,
  dispatch: AppDispatch,
  runStep: HistoryStep["run"],
  port: OrganizerPort,
  change: OrganizerChange,
) =>
  runOrganizerTask(store, dispatch, () =>
    runStep(() => changeDrawerOrganizers(change, { dispatch, getState: store.getState, port }), isApplied),
  );

const answered = (result: OrganizerChangeResult | null) =>
  result !== null && (result.status === "applied" || result.status === "partial" || result.status === "noop");

export const useOrganizerEditor = ({ port: portOverride }: OrganizerEditorOptions = {}): OrganizerEditor => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const { run: runStep } = useHistoryStep();
  const port = useMemo(() => portOverride ?? createOrganizerPort(), [portOverride]);

  return useMemo(() => {
    const ui = () => selectOrganizersUi(store.getState());
    const step = (change: OrganizerChange) => runOrganizerStep(store, dispatch, runStep, port, change);

    /** Writes a changed draft as one step (not while an undo restores), then clears the preview. */
    const flushDraft = async () => {
      const { panel, draft, selected } = ui();
      if (panel !== "editor" || !draft || !selected) return;

      const state = store.getState();
      if (!getIsHistoryRestoring(state) && !samePositions(draft, positionsOf(state, selected))) {
        await step({ kind: "setColumnLayout", ...columnTargetOf(selected), positions: draft });
      }
      await port.preview(null);
    };

    const exitDrawer = async () => {
      await flushDraft();
      dispatch(selectColumnAction(null));
      await port.exitView();
    };

    const openDrawer = async (address: OrganizerAddress) => {
      const { view } = ui();
      if (view?.cabinetKey === address.cabinetKey && view.drawer === address.drawer) return;

      const runtimeId = runtimeIdOf(store.getState(), address.cabinetKey);
      if (!runtimeId) {
        console.warn("[drawerOrganizers] no placed cabinet for", address);
        return;
      }
      await flushDraft();
      await port.enterView({ runtimeId, drawer: address.drawer });
    };

    return {
      async addColumn(slot) {
        const { view, panel, pendingStyle } = ui();
        if (!view) return;
        if (panel === "editor") {
          dispatch(pulseSave());
          return;
        }
        const style = pendingStyle[organizerDrawerKey(view)] ?? selectOrganizerSet(store.getState(), view)?.style;
        await step({
          kind: "addColumn",
          cabinetId: view.cabinetKey,
          drawer: view.drawer,
          slot,
          ...(style === undefined ? {} : { style }),
        });
      },

      selectColumn(slot) {
        const { view, panel } = ui();
        if (panel === "editor") {
          dispatch(pulseSave());
          return;
        }
        dispatch(selectColumnAction(view && slot !== null ? { ...view, slot } : null));
      },

      async applyPreset(presetId) {
        const { selected } = ui();
        const preset = selectOrganizerRules(store.getState())?.presets.find(({ id }) => id === presetId);
        if (!selected || !preset) return;

        // The answer (applied or noop) is already in the read-model: the list shows the preset as active.
        await step({
          kind: "setColumnLayout",
          ...columnTargetOf(selected),
          positions: [...preset.positions],
        });
      },

      openEditor() {
        const { selected } = ui();
        if (selected) dispatch(openEditorAction(positionsOf(store.getState(), selected) ?? []));
      },

      toggle(position) {
        const state = store.getState();
        const { panel, draft, selected, derived } = selectOrganizersUi(state);
        if (panel !== "editor" || !draft || !selected) return { blocked: false };

        const runtimeId = runtimeIdOf(state, selected.cabinetKey);
        const maxActive =
          derived[organizerDrawerKey(selected)]?.profile?.maxActive ?? selectOrganizerRules(state)?.maxActive ?? 0;
        const { next, blocked } = togglePosition(draft, position, maxActive);

        if (blocked) {
          dispatch(showNotice({ key: ORGANIZER_MESSAGE_KEYS.maxPositions, undoHint: false }));
          return { blocked };
        }
        dispatch(setDraft(next));
        if (runtimeId) void port.preview({ runtimeId, drawer: selected.drawer, slot: selected.slot, positions: next });
        return { blocked };
      },

      async save() {
        const { panel, draft, selected } = ui();
        if (panel !== "editor" || !draft || !selected) return;

        const result = await step({ kind: "setColumnLayout", ...columnTargetOf(selected), positions: draft });
        if (!answered(result)) return;
        await port.preview(null);
        dispatch(backToPresets());
      },

      back() {
        if (ui().panel !== "editor") return;
        void port.preview(null);
        dispatch(backToPresets());
      },

      async remove() {
        const { selected } = ui();
        if (!selected) return;

        const result = await step({ kind: "removeColumn", ...columnTargetOf(selected) });
        if (!answered(result)) return;
        dispatch(selectColumnAction(null));
        if (result && isApplied(result)) {
          dispatch(showNotice({ key: ORGANIZER_MESSAGE_KEYS.columnRemoved, undoHint: true }));
        }
      },

      async setStyle(style) {
        const { view } = ui();
        if (!view) return;
        // Kept for the drawer either way, so the next column never takes an older choice.
        dispatch(setPendingStyle({ address: view, style }));
        if (!selectOrganizerSet(store.getState(), view)) return;
        await step({ kind: "setStyle", cabinetId: view.cabinetKey, drawer: view.drawer, style });
      },

      openDrawer,

      closeDrawer: exitDrawer,

      async switchDrawer(drawer) {
        const { view } = ui();
        if (view) await openDrawer({ cabinetKey: view.cabinetKey, drawer });
      },

      async leave() {
        if (ui().view) await exitDrawer();
      },

      setViewInsets(insets) {
        void port.setViewInsets(insets);
      },
    };
  }, [dispatch, port, runStep, store]);
};
