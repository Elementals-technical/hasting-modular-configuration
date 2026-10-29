import { useEffect } from "react";

import { selectMessage } from "@/entities/collection/lib/productProfileSelectors";
import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import { getActiveProductProfile, getStableKeyForRuntimeId } from "@/entities/configuration/model/store/selectors";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { organizerOverlayStore } from "../lib/organizerOverlayStore";
import { useOrganizerEditor } from "../lib/useOrganizerEditor";
import { useOrganizerRuntime } from "../lib/useOrganizerRuntime";
import { ORGANIZER_MESSAGE_KEYS } from "../model/messages";
import { isDrawerEditable } from "../model/rules";
import { selectEffectiveDividersOption, selectOrganizersUi } from "../model/store/selectors";
import { dismissNotice, showNotice } from "../model/store/slice";
import { organizerDrawerKey } from "../model/types";

import { OrganizerCanvasOverlay } from "./OrganizerCanvasOverlay";

import s from "./OrganizerCanvasOverlay.module.scss";

/** How long a notice stays; the locked-zone answer to a tap is a short one. */
const NOTICE_MS = 5000;
const LOCKED_ZONE_NOTICE_MS = 2500;

const CUSTOMIZE = "Customize";
const DRAWERS: readonly DrawerName[] = ["Top", "Bot"];

/**
 * The organizers' layer over the 3D canvas, one per iframe: it starts the runtime (`useOrganizerRuntime`),
 * draws the controls while the Drawer Dividers section is open on Customize, and shows the notices.
 * Every action goes to `useOrganizerEditor`; this component only translates between what the frame says
 * (runtime ids) and what the store keeps (stable keys).
 */
export const DrawerOrganizerLayer = ({ ready }: { ready: boolean }) => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const editor = useOrganizerEditor();
  useOrganizerRuntime(ready);

  const profile = useAppSelector(getActiveProductProfile);
  const { sectionActive, view, selected, panel, draft, busy, derived } = useAppSelector(selectOrganizersUi);
  const option = useAppSelector(selectEffectiveDividersOption);

  // 1. The controls belong to the section: open, and on Customize.
  const showOverlay = sectionActive && option === CUSTOMIZE;

  // 2. The Top | Bottom switch needs both drawers of the cabinet in view to be editable.
  const editableDrawers = view
    ? DRAWERS.filter((drawer) => isDrawerEditable(derived[organizerDrawerKey({ cabinetKey: view.cabinetKey, drawer })]))
    : [];

  // 3. A frame names a product by its runtime id; the editor wants the stable key.
  const openDrawer = ({ productId, drawer }: { productId: string; drawer: DrawerName }) => {
    const cabinetKey = getStableKeyForRuntimeId(store.getState(), productId);
    if (!cabinetKey) {
      console.warn("[drawerOrganizers] no stable key for the product of a drawer pill", productId);
      return;
    }
    void editor.openDrawer({ cabinetKey, drawer });
  };

  return (
    <>
      {showOverlay && (
        <OrganizerCanvasOverlay
          store={organizerOverlayStore}
          selectedSlot={selected?.slot ?? null}
          panel={panel}
          draftCells={panel === "editor" ? draft : null}
          busy={busy}
          lockedZoneText={selectMessage(profile, ORGANIZER_MESSAGE_KEYS.lockedZone)}
          switchDrawers={editableDrawers.length === DRAWERS.length ? editableDrawers : []}
          onPlus={(slot) => void editor.addColumn(slot)}
          onColumn={editor.selectColumn}
          onOpenDrawer={openDrawer}
          onCloseDrawer={() => void editor.closeDrawer()}
          onSwitchDrawer={(drawer) => void editor.switchDrawer(drawer)}
          onLockedZone={() => dispatch(showNotice({ key: ORGANIZER_MESSAGE_KEYS.lockedZone, undoHint: false }))}
        />
      )}
      <OrganizerNotice />
    </>
  );
};

/**
 * What happened to the user's columns that they did not ask for (a size change dropped some, a command
 * was refused), or a short answer to a tap. It closes itself, or with ×; an undoable change says how.
 * Stands under the scene's own refusal notice, which is at top: 24px.
 */
const OrganizerNotice = () => {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(getActiveProductProfile);
  const notice = useAppSelector((state) => selectOrganizersUi(state).notice);

  // A new notice (a new id) restarts the timer, even when its text is the same.
  const noticeId = notice?.id;
  const noticeKey = notice?.key;
  useEffect(() => {
    if (noticeId === undefined) return;
    const lifetimeMs = noticeKey === ORGANIZER_MESSAGE_KEYS.lockedZone ? LOCKED_ZONE_NOTICE_MS : NOTICE_MS;
    const timer = window.setTimeout(() => dispatch(dismissNotice(noticeId)), lifetimeMs);
    return () => window.clearTimeout(timer);
  }, [dispatch, noticeId, noticeKey]);

  return (
    <div className={s.notice} role="status" aria-live="polite">
      {notice && (
        <div className={s.noticeCard}>
          <div>
            <p className={s.noticeText}>{selectMessage(profile, notice.key, notice.params)}</p>
            {notice.undoHint && (
              <p className={s.noticeHint}>{selectMessage(profile, ORGANIZER_MESSAGE_KEYS.undoHint)}</p>
            )}
          </div>
          <button
            type="button"
            className={s.noticeClose}
            aria-label="Dismiss"
            onClick={() => dispatch(dismissNotice(notice.id))}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
