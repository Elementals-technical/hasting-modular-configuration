import { useSyncExternalStore } from "react";
import clsx from "clsx";

import { actionAnchor, visibleOverlayFrame, type PlacementOverlayStore } from "../lib/placementOverlayStore";
import { CloseIcon, MoveIcon } from "./placementIcons";

import s from "./CabinetPlacementDebug.module.scss";

type Props = {
  store: PlacementOverlayStore;
  sessionId: string | null;
  applyDisabled: boolean;
  cancelDisabled: boolean;
  onApply: () => void;
  onCancel: () => void;
};

/**
 * Icons of an open cabinet draft, placed at the anchors PlayCanvas publishes: the move icon on the
 * cabinet's front, Apply and discard (×) under its bottom-right corner. The green / red tint and
 * the outline are drawn by PlayCanvas. The layer never takes pointer input except on the buttons,
 * so dragging the cabinet goes straight to the canvas underneath.
 */
export function CabinetDraftOverlay({ store, sessionId, applyDisabled, cancelDisabled, onApply, onCancel }: Props) {
  const frame = visibleOverlayFrame(useSyncExternalStore(store.subscribe, store.get), sessionId);
  if (!frame?.points) return null;
  const { frontCenter } = frame.points;
  const bottomRight = actionAnchor(frame) ?? frame.points.bottomRight;
  const colliding = frame.status === "colliding";
  const actions = frame.lifecycle === "preview";
  return (
    <div className={s.overlay} data-status={frame.status} data-testid="cabinet-draft-overlay">
      <span
        className={clsx(s.moveMarker, colliding && s.moveMarkerColliding)}
        style={{ left: frontCenter.x, top: frontCenter.y }}
        aria-hidden="true"
      >
        <MoveIcon />
      </span>
      {actions && (
        <>
          <button
            type="button"
            className={s.applyChip}
            style={{ left: bottomRight.x - 3, top: bottomRight.y + 5 }}
            disabled={applyDisabled || !frame.canApply}
            title={colliding ? "This cabinet overlaps another cabinet. Move it to a free spot to apply." : undefined}
            onClick={onApply}
          >
            Apply
          </button>
          <button
            type="button"
            className={s.discardChip}
            style={{ left: bottomRight.x + 3, top: bottomRight.y + 3 }}
            aria-label="Discard cabinet placement"
            disabled={cancelDisabled || !frame.canCancel}
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </>
      )}
    </div>
  );
}
