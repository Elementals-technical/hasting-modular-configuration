import { useMemo } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { selectAttribute, selectMessage } from "@/entities/collection/lib/productProfileSelectors";
import type { CustomizationFieldDefinition } from "@/entities/collection/model/customizationSchema";
import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getStableKeyForRuntimeId,
} from "@/entities/configuration/model/store/selectors";
import { isApplied, useHistoryStep } from "@/entities/history/lib/useHistoryStep";
import { useChangeAttribute, type CommandRunner } from "@/features/configurationCommands";
import { changeDrawerOrganizers } from "@/features/configurationCommands/lib/changeDrawerOrganizers";
import { createOrganizerPort, type OrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { ORGANIZER_MESSAGE_KEYS } from "../model/messages";
import { isDrawerEditable } from "../model/rules";
import {
  selectColumnCount,
  selectEffectiveDividersOption,
  selectHasOrganizerColumns,
  selectOrganizerRules,
  selectOrganizerSet,
  selectOrganizersUi,
} from "../model/store/selectors";
import { setSectionActive, showNotice } from "../model/store/slice";
import { organizerDrawerKey } from "../model/types";
import { organizerOverlayStore, type OrganizerOverlayStore } from "./organizerOverlayStore";
import { runOrganizerTask, useOrganizerEditor } from "./useOrganizerEditor";

/**
 * The Drawer Dividers section of the Accessories page for a collection with organizers: the None / Customize
 * chips, the hint under them, the style chips and the column counter (C1 §1.3 T1–T2, §3.4).
 *
 * The option shown is Customize while the scene holds columns (after a restore too). None with columns
 * clears every cabinet and records the option as one history step; the option itself goes through the
 * command runner (`change`), never a direct setter.
 */

export type OrganizerStyleChip = {
  value: string;
  label: string;
  available: boolean;
  reason: string | null;
  selected: boolean;
};

export type OrganizerSection = {
  option: string;
  changeOption(value: string): Promise<void>;
  hint: string | null;
  styles: OrganizerStyleChip[];
  /** Style chips make sense only with two styles to pick from (Oak is off in v1, so not in the MVP). */
  showStyles: boolean;
  changeStyle(style: string): Promise<void>;
  /** Columns of the drawer in view; null outside the view. */
  counter: { columns: number; drawer: DrawerName } | null;
  onSectionToggle(open: boolean): void;
};

export type OrganizerSectionOptions = {
  /** The `DividersOption` field of the step (`ui.json`), for its hints. */
  field?: CustomizationFieldDefinition | null;
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  port?: OrganizerPort;
  /** Tests pass a stand-in for the command runner's `change`. */
  change?: CommandRunner["change"];
  overlay?: OrganizerOverlayStore;
};

const DIVIDERS_OPTION = "DividersOption";
const CUSTOMIZE = "Customize";
const NONE = "None";

export const useOrganizerSection = ({
  field = null,
  port: portOverride,
  change: changeOverride,
  overlay = organizerOverlayStore,
}: OrganizerSectionOptions = {}): OrganizerSection => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const { run: runStep } = useHistoryStep();
  const runner = useChangeAttribute();
  const change = changeOverride ?? runner.change;
  const port = useMemo(() => portOverride ?? createOrganizerPort(), [portOverride]);
  const editor = useOrganizerEditor({ port });

  const profile = useAppSelector(getActiveProductProfile);
  const rules = useAppSelector(selectOrganizerRules);
  const option = useAppSelector(selectEffectiveDividersOption) ?? NONE;
  const { view, derived, pendingStyle } = useAppSelector(selectOrganizersUi);
  const cabinets = useAppSelector(getCabinetEntries);
  const viewSet = useAppSelector((state) => (view ? selectOrganizerSet(state, view) : null));
  const columns = useAppSelector((state) => selectColumnCount(state));

  const anyEligible = cabinets.some(({ stableKey }) =>
    (["Top", "Bot"] as const).some((drawer) =>
      isDrawerEditable(derived[organizerDrawerKey({ cabinetKey: stableKey, drawer })]),
    ),
  );

  const hint = (() => {
    const fieldHint = field?.hints?.[option] ?? null;
    if (option !== CUSTOMIZE) return fieldHint;
    if (!anyEligible) return selectMessage(profile, ORGANIZER_MESSAGE_KEYS.unavailable);
    if (!view) return selectMessage(profile, ORGANIZER_MESSAGE_KEYS.hintOpenDrawer);

    const unavailable = derived[organizerDrawerKey(view)]?.unavailable;
    if (unavailable === "FULL") return selectMessage(profile, ORGANIZER_MESSAGE_KEYS.drawerFull);
    if (unavailable === "LOCKED_FULL" || unavailable === "UNSUPPORTED_WIDTH") {
      return selectMessage(profile, ORGANIZER_MESSAGE_KEYS.unavailable);
    }
    return fieldHint;
  })();

  const chosenStyle = (view ? (pendingStyle[organizerDrawerKey(view)] ?? viewSet?.style) : undefined) ?? null;
  const styles: OrganizerStyleChip[] = (selectAttribute(profile, "DividersStyle")?.options ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(({ value, label }) => {
      const reasonKey = rules?.unavailableStyles[value];
      return {
        value,
        label,
        available: !reasonKey,
        reason: reasonKey ? selectMessage(profile, reasonKey) : null,
        selected: value === chosenStyle,
      };
    });

  const changeOption = async (value: string) => {
    if (value === NONE && selectHasOrganizerColumns(store.getState())) {
      // T2: every column goes, with the option, as one step the user can undo.
      const result = await runOrganizerTask(store, dispatch, () =>
        runStep(async () => {
          const cleared = await changeDrawerOrganizers({ kind: "clear" }, { dispatch, getState: store.getState, port });
          // Columns the scene kept keep the option at Customize: it changes only with them.
          if (cleared.status === "rejected" || cleared.status === "error") return cleared;
          await change({ attributeId: DIVIDERS_OPTION, value: NONE, scope: "global" });
          return cleared;
        }, isApplied),
      );
      await port.preview(null);
      await port.exitView();
      if (result && isApplied(result)) dispatch(showNotice({ key: ORGANIZER_MESSAGE_KEYS.cleared, undoHint: true }));
      return;
    }

    await runStep(() => change({ attributeId: DIVIDERS_OPTION, value, scope: "global" }));
    if (value !== CUSTOMIZE) return;

    // T1 / Q-D4: with one drawer to edit in the whole scene, it opens at once.
    const eligible = overlay.get()?.entries.filter((entry) => entry.eligible) ?? [];
    if (eligible.length !== 1) return;
    const cabinetKey = getStableKeyForRuntimeId(store.getState(), eligible[0].productId);
    if (cabinetKey) await editor.openDrawer({ cabinetKey, drawer: eligible[0].drawer });
  };

  return {
    option,
    changeOption,
    hint,
    styles,
    showStyles: styles.filter(({ available }) => available).length >= 2,
    changeStyle: (style) => editor.setStyle(style),
    counter: view ? { columns, drawer: view.drawer } : null,
    onSectionToggle: (open) => dispatch(setSectionActive(open)),
  };
};
