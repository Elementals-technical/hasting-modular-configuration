import { useSyncExternalStore, type CSSProperties } from "react";
import clsx from "clsx";
import { Ban } from "lucide-react";

import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import type { OrganizersOverlayFrame, OrganizersPoint } from "@/features/configuratorApi";

import type { OrganizerOverlayStore } from "../lib/organizerOverlayStore";
import type { PanelMode } from "../model/types";

import { DRAWER_LABELS } from "./drawerLabels";

import s from "./OrganizerCanvasOverlay.module.scss";

/** Smallest touch target (WCAG 2.5.5, and the card's rule for ⊕, columns and pills). */
const MIN_TARGET_PX = 44;
const PLUS_Z_INDEX = 1;
/** A column is above the ⊕ it covers (M2): the user then selects the column. */
const COLUMN_Z_INDEX = 2;

export type OrganizerCanvasOverlayProps = {
  store: OrganizerOverlayStore;
  selectedSlot: number | null;
  panel: PanelMode;
  /**
   * The cells with an insert in the draft of the selected column (1 = the back cell), or null outside the
   * editor. While the editor is open the overlay tints these cells in 3D.
   */
  draftCells: readonly number[] | null;
  busy: boolean;
  /** The collection's text for a drain area (`organizer.lockedZone`). */
  lockedZoneText: string;
  /** The drawers of the cabinet in view that can be edited; exactly two show the Top | Bottom switch. */
  switchDrawers: readonly DrawerName[];
  onPlus(slot: number): void;
  onColumn(slot: number): void;
  onOpenDrawer(entry: { productId: string; drawer: DrawerName }): void;
  onCloseDrawer(): void;
  onSwitchDrawer(drawer: DrawerName): void;
  /** A tap on the locked zone (touch has no hover): the container tells the user why. */
  onLockedZone?(): void;
};

type Frame = OrganizersOverlayFrame;
type PlusSlot = Frame["plus"][number];
type ColumnFrame = Frame["columns"][number];

/**
 * Coordinates are CSS px of the iframe, 1:1 with the canvas (the frame says so), so the layer covers the
 * iframe exactly and lets every click through except those on its own controls (`pointer-events: auto`
 * in the stylesheet).
 */
const ROOT_STYLE: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 25 };

const visibleFrame = (frame: Frame | null): Frame | null => (frame && frame.visible ? frame : null);

/** A box of `size` px centred on a point. */
const centredBox = (centre: OrganizersPoint, width: number, height: number): CSSProperties => ({
  left: centre.x - width / 2,
  top: centre.y - height / 2,
  width,
  height,
});

const polygonPoints = (hull: readonly OrganizersPoint[]) => hull.map(({ x, y }) => `${x},${y}`).join(" ");

/** The box around a hull, widened to the touch target around the same centre. */
const touchBox = (hull: readonly OrganizersPoint[]): CSSProperties => {
  const xs = hull.map(({ x }) => x);
  const ys = hull.map(({ y }) => y);
  const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const width = Math.max(MIN_TARGET_PX, Math.max(...xs) - Math.min(...xs));
  const height = Math.max(MIN_TARGET_PX, Math.max(...ys) - Math.min(...ys));
  return centredBox(centre, width, height);
};

const plusLabel = (side: PlusSlot["side"]) =>
  side === "left"
    ? "Add divider column (left)"
    : side === "right"
      ? "Add divider column (right)"
      : "Add divider column";

const columnWord = (count: number) => (count === 1 ? "1 column" : `${count} columns`);

/**
 * The controls over the 3D drawer, drawn from the frame 3D publishes (`organizersOverlay`): outside the
 * view an "Open Drawer" pill on each drawer that can be edited; in the view a ⊕ on every free slot, a
 * hit area on every column, the locked zone and "Close Drawer" (with a Top | Bottom switch for a cabinet
 * with two drawers). A pure view of `store` and the props: every action goes out through a callback.
 *
 * Example: the frame `in-view-empty` of `frames.v1.json` draws one ⊕ at (400, 300) and Close Drawer at (400, 555).
 */
export const OrganizerCanvasOverlay = ({
  store,
  selectedSlot,
  panel,
  draftCells,
  busy,
  lockedZoneText,
  switchDrawers,
  onPlus,
  onColumn,
  onOpenDrawer,
  onCloseDrawer,
  onSwitchDrawer,
  onLockedZone,
}: OrganizerCanvasOverlayProps) => {
  const frame = visibleFrame(useSyncExternalStore(store.subscribe, store.get));
  // 1. No frame, or 3D says nothing is to be shown (the section is closed, the camera moved away): no layer.
  if (!frame) return null;

  return (
    <div style={ROOT_STYLE} data-testid="organizer-overlay">
      {frame.view === null ? (
        <OpenDrawerPills entries={frame.entries} onOpenDrawer={onOpenDrawer} />
      ) : (
        <>
          <ViewControls
            frame={frame}
            selectedSlot={selectedSlot}
            editing={panel === "editor"}
            draftCells={draftCells}
            busy={busy}
            onPlus={onPlus}
            onColumn={onColumn}
          />
          {frame.lock && <LockedZone lock={frame.lock} lockedZoneText={lockedZoneText} onLockedZone={onLockedZone} />}
          {frame.closeAnchor && (
            <CloseDrawerBar
              anchor={frame.closeAnchor}
              drawerInView={frame.view.drawer}
              switchDrawers={switchDrawers}
              onCloseDrawer={onCloseDrawer}
              onSwitchDrawer={onSwitchDrawer}
            />
          )}
        </>
      )}
    </div>
  );
};

/** V0: "Open Drawer" on each drawer that can be edited; a drawer with columns also shows how many. */
const OpenDrawerPills = ({
  entries,
  onOpenDrawer,
}: {
  entries: Frame["entries"];
  onOpenDrawer: OrganizerCanvasOverlayProps["onOpenDrawer"];
}) => (
  <>
    {entries
      .filter(({ eligible }) => eligible)
      .map(({ productId, drawer, anchor, count }) => (
        <button
          key={`${productId}:${drawer}`}
          type="button"
          className={clsx(s.interactive, s.pill)}
          style={{ left: anchor.x, top: anchor.y }}
          title={`${DRAWER_LABELS[drawer]} drawer`}
          aria-label={count > 0 ? `Open drawer, ${columnWord(count)}` : undefined}
          onClick={() => onOpenDrawer({ productId, drawer })}
        >
          <span className={s.pillFace}>
            Open Drawer
            {count > 0 && (
              <span className={s.badge} data-count-badge="" aria-hidden="true">
                ✓ {count}
              </span>
            )}
          </span>
        </button>
      ))}
  </>
);

type ViewControlsProps = {
  frame: Frame;
  selectedSlot: number | null;
  /** The editor is open: ⊕ is dimmed, a click only draws attention to Save (T10). */
  editing: boolean;
  /** The cells to tint on the selected column while editing; see `OrganizerCanvasOverlayProps`. */
  draftCells: readonly number[] | null;
  busy: boolean;
  onPlus: OrganizerCanvasOverlayProps["onPlus"];
  onColumn: OrganizerCanvasOverlayProps["onColumn"];
};

/**
 * The cells of a column that hold an insert in the draft, as `[cell, polygon]` pairs. The frame lists the cells
 * from the back wall to the facade, so cell `k` is `column.cells[k - 1]`. A cell the frame does not have is skipped.
 *
 * Example: `litCellsOf(column, [2, 4])` gives `[[2, column.cells[1]], [4, column.cells[3]]]`.
 */
const litCellsOf = (column: ColumnFrame, draftCells: readonly number[]): Array<[number, OrganizersPoint[]]> =>
  draftCells.flatMap((cell): Array<[number, OrganizersPoint[]]> => {
    const polygon = column.cells[cell - 1];
    return polygon ? [[cell, polygon]] : [];
  });

/** V1: the ⊕ of the free slots and the hit areas of the columns, in screen order (left to right) for Tab. */
const ViewControls = ({ frame, selectedSlot, editing, draftCells, busy, onPlus, onColumn }: ViewControlsProps) => {
  // 1. Columns are numbered left to right, the order a screen reader walks them in.
  const columnsLeftToRight = [...frame.columns].sort((a, b) => a.center.x - b.center.x);
  const columnNumber = (column: ColumnFrame) => columnsLeftToRight.indexOf(column) + 1;

  // 2. One list for both kinds, sorted by x. The sort is stable, so a ⊕ stays before a column at the same x.
  const controls = [
    ...frame.plus.map((plus) => ({ kind: "plus" as const, x: plus.center.x, plus })),
    ...frame.columns.map((column) => ({ kind: "column" as const, x: column.center.x, column })),
  ].sort((a, b) => a.x - b.x);

  return (
    <>
      {controls.map((control) =>
        control.kind === "plus" ? (
          <button
            key={control.plus.id}
            type="button"
            className={clsx(s.interactive, s.plus)}
            style={{ ...centredBox(control.plus.center, MIN_TARGET_PX, MIN_TARGET_PX), zIndex: PLUS_Z_INDEX }}
            aria-label={plusLabel(control.plus.side)}
            aria-disabled={editing || busy}
            aria-busy={busy}
            data-tooltip="Add column"
            onClick={() => onPlus(control.plus.slot)}
          >
            <span className={s.plusDisc} aria-hidden="true">
              +
            </span>
          </button>
        ) : (
          <div key={`column:${control.column.slot}`} className={s.column} style={{ zIndex: COLUMN_Z_INDEX }}>
            <svg className={s.hullSvg} aria-hidden="true" focusable="false">
              <polygon
                className={s.hull}
                data-column-hull=""
                data-selected={control.column.slot === selectedSlot}
                data-editing={editing}
                points={polygonPoints(control.column.hull)}
              />
              {/* While editing, only the selected column tints the cells of its draft; the rest stay empty. */}
              {editing &&
                control.column.slot === selectedSlot &&
                litCellsOf(control.column, draftCells ?? []).map(([cell, polygon]) => (
                  <polygon key={cell} className={s.draftCell} data-draft-cell={cell} points={polygonPoints(polygon)} />
                ))}
            </svg>
            <button
              type="button"
              className={clsx(s.interactive, s.columnButton)}
              style={touchBox(control.column.hull)}
              aria-label={`Divider column ${columnNumber(control.column)} of ${columnsLeftToRight.length}`}
              aria-pressed={control.column.slot === selectedSlot}
              data-organizer-slot={control.column.slot}
              onClick={() => onColumn(control.column.slot)}
            />
          </div>
        ),
      )}
    </>
  );
};

/** The drain area: nothing can be placed in it. Hover or focus shows why; a tap tells it (touch). */
const LockedZone = ({
  lock,
  lockedZoneText,
  onLockedZone,
}: {
  lock: NonNullable<Frame["lock"]>;
  lockedZoneText: string;
  onLockedZone: OrganizerCanvasOverlayProps["onLockedZone"];
}) => (
  <>
    <svg className={s.hullSvg} aria-hidden="true" focusable="false">
      <polygon className={s.lockHull} points={polygonPoints(lock.hull)} />
    </svg>
    <span
      role="img"
      tabIndex={0}
      className={clsx(s.interactive, s.lockMarker)}
      style={centredBox(lock.center, MIN_TARGET_PX, MIN_TARGET_PX)}
      aria-label={lockedZoneText}
      data-tooltip={lockedZoneText}
      onClick={onLockedZone}
    >
      <Ban size={24} aria-hidden="true" />
    </span>
  </>
);

/** "Close Drawer" at its anchor; the Top | Bottom switch stands beside it so the pill keeps the anchor. */
const CloseDrawerBar = ({
  anchor,
  drawerInView,
  switchDrawers,
  onCloseDrawer,
  onSwitchDrawer,
}: {
  anchor: OrganizersPoint;
  drawerInView: DrawerName;
  switchDrawers: readonly DrawerName[];
  onCloseDrawer: () => void;
  onSwitchDrawer: (drawer: DrawerName) => void;
}) => (
  <div className={s.closeBar} style={{ left: anchor.x, top: anchor.y }}>
    {switchDrawers.length === 2 && (
      <div className={s.switch} role="group" aria-label="Drawer">
        {switchDrawers.map((drawer) => (
          <button
            key={drawer}
            type="button"
            className={clsx(s.interactive, s.switchButton)}
            aria-pressed={drawer === drawerInView}
            onClick={() => onSwitchDrawer(drawer)}
          >
            {DRAWER_LABELS[drawer]}
          </button>
        ))}
      </div>
    )}
    <button type="button" className={clsx(s.interactive, s.pill, s.closePill)} onClick={onCloseDrawer}>
      <span className={s.pillFace}>Close Drawer</span>
    </button>
  </div>
);
