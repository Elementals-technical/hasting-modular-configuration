import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "react-redux";
import clsx from "clsx";

import type { RootState } from "@/app/store";
import { useActiveCollection } from "@/entities/collection";
import type { OrganizersViewInsets } from "@/features/configuratorApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { useOrganizerEditor, type OrganizerEditor } from "../lib/useOrganizerEditor";
import { buildPresetCards, matchPreset } from "../model/presets";
import {
  selectOrganizerRules,
  selectOrganizersEnabled,
  selectOrganizersUi,
  selectViewSet,
} from "../model/store/selectors";
import { setPanelLayout, type DrawerOrganizersUiState, type OrganizerPanelLayout } from "../model/store/slice";
import { organizerDrawerKey } from "../model/types";

import { PositionsEditor } from "./PositionsEditor";
import { PresetList } from "./PresetList";

import s from "./DividerOptionsPanel.module.scss";

const DEFAULT_TITLE = "Divider Options";
const DEFAULT_CUSTOMIZE_LABEL = "Customize";

/** Width of a tablet and below: the panel is a strip or a rail instead of the 160 px column. */
export const ORGANIZER_MEDIA = {
  compact: "(max-width: 1024px)",
  short: "(max-height: 620px)",
  landscape: "(orientation: landscape)",
} as const;

/**
 * The room the panel takes from the 3D view, in CSS px (C1 §3.1). 3D wants all four sides every time.
 * Desktop: the 160 px column on the left. M1: a 96 px rail under the 58 px step bar. M2: a 72 px strip.
 */
const VIEW_INSETS: Readonly<Record<OrganizerPanelLayout, OrganizersViewInsets>> = {
  desktop: { left: 160, right: 0, top: 0, bottom: 0 },
  m1: { left: 96, right: 0, top: 58, bottom: 0 },
  m2: { left: 0, right: 0, top: 0, bottom: 72 },
};
const NO_INSETS: OrganizersViewInsets = { left: 0, right: 0, top: 0, bottom: 0 };

const isPanelOpen = ({ panel, view }: DrawerOrganizersUiState) => panel !== "closed" && view !== null;

/**
 * Left offset of the canvas toolbar (`--player-left-inset`) while the panel stands beside the canvas:
 * "160px" (desktop) or "96px" (M1). The M2 strip is under the canvas, so it needs none; closed, none.
 */
export const usePlayerLeftInset = (): string | undefined =>
  useAppSelector((state) => {
    const organizersUi = selectOrganizersUi(state);
    // A collection without organizers never has the panel, whatever the UI state holds.
    const standsBesideCanvas =
      selectOrganizersEnabled(state) && isPanelOpen(organizersUi) && organizersUi.layout !== "m2";
    return standsBesideCanvas ? `${VIEW_INSETS[organizersUi.layout].left}px` : undefined;
  });

/** Whether a media query matches now; false where the browser has no `matchMedia`. */
const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  );

/**
 * desktop above 1024 px. At 1024 px and below: M1 only when ui.json asks for it and the screen is neither
 * short nor landscape (a rail needs height); otherwise M2, the default.
 */
const useOrganizerPanelLayout = (mobileLayout: "M1" | "M2" | undefined): OrganizerPanelLayout => {
  const compact = useMediaQuery(ORGANIZER_MEDIA.compact);
  const short = useMediaQuery(ORGANIZER_MEDIA.short);
  const landscape = useMediaQuery(ORGANIZER_MEDIA.landscape);

  if (!compact) return "desktop";
  return mobileLayout === "M1" && !short && !landscape ? "m1" : "m2";
};

/** A key press in a text field belongs to the field. */
const isTextEntry = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Esc steps back (editor -> list -> nothing selected); Delete / Backspace remove the column from the list. */
const usePanelKeys = (open: boolean, editor: OrganizerEditor) => {
  const store = useStore<RootState>();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // 1. Another handler took the key, or the user is typing.
      if (event.defaultPrevented || isTextEntry(event.target)) return;

      const { panel } = selectOrganizersUi(store.getState());
      if (event.key === "Escape") {
        if (panel === "editor") editor.back();
        else editor.selectColumn(null);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        // 2. In the editor the key does nothing: positions are toggled with the buttons.
        if (panel !== "presets") return;
        event.preventDefault();
        void editor.remove();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, editor, store]);
};

/**
 * Where the focus goes (C1 §3.3): the title when the panel opens; the selected column's button when it
 * closes and the focus was lost with it (a preset, Save, Esc); the Customize card after ← from the editor.
 */
const usePanelFocus = (
  { panel, selected, view }: DrawerOrganizersUiState,
  open: boolean,
  titleRef: React.RefObject<HTMLHeadingElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
) => {
  const previous = useRef({ open: false, panel, slot: null as number | null });

  useEffect(() => {
    const before = previous.current;
    previous.current = { open, panel, slot: selected?.slot ?? before.slot };

    if (open && !before.open) {
      titleRef.current?.focus();
    } else if (!open && before.open && view) {
      // The panel left the page with the focus in it: the focus is on <body> now.
      const focusLost = document.activeElement === document.body || document.activeElement === null;
      const columnButton = document.querySelector<HTMLElement>(`[data-organizer-slot="${before.slot}"]`);
      if (focusLost) columnButton?.focus();
    } else if (open && before.panel === "editor" && panel === "presets") {
      panelRef.current?.querySelector<HTMLElement>('[data-preset-id="customize"]')?.focus();
    }
  }, [open, panel, selected, view, titleRef, panelRef]);
};

/**
 * Tells 3D how much of the view the panel covers while it is open, and gives it back on close. Nothing is
 * sent for a panel that was never open, and 3D is told only when the room changes.
 */
const useViewInsets = (open: boolean, layout: OrganizerPanelLayout, editor: OrganizerEditor) => {
  const sent = useRef(false);

  useEffect(() => {
    if (open) {
      editor.setViewInsets(VIEW_INSETS[layout]);
      sent.current = true;
    } else if (sent.current) {
      editor.setViewInsets(NO_INSETS);
      sent.current = false;
    }
  }, [open, layout, editor]);
};

/**
 * Divider Options (C1 §3): beside the 3D view while a column is selected. The preset list (P1) or the
 * positions editor (P2) of the selected column. A container: every action is the editor hook's, the
 * layout follows the screen, and the view insets tell 3D how much of the canvas the panel covers.
 */
export const DividerOptionsPanel = () => {
  const dispatch = useAppDispatch();
  const editor = useOrganizerEditor();
  const organizersUi = useAppSelector(selectOrganizersUi);
  const rules = useAppSelector(selectOrganizerRules);
  const viewSet = useAppSelector(selectViewSet);
  const wording = useActiveCollection((collection) => collection.catalog.customization?.drawerOrganizers);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const { panel, selected, draft, derived, busy, savePulse } = organizersUi;
  // A collection without organizers has no panel, whatever the UI state holds.
  const open = rules !== null && isPanelOpen(organizersUi);

  // 1. The layout belongs to the screen; the store keeps a copy for the toolbar offset and the 3D focus mode.
  const layout = useOrganizerPanelLayout(wording?.mobileLayout);
  useEffect(() => {
    if (layout !== organizersUi.layout) dispatch(setPanelLayout(layout));
  }, [dispatch, layout, organizersUi.layout]);

  useViewInsets(open, layout, editor);
  usePanelKeys(open, editor);
  usePanelFocus(organizersUi, open, titleRef, panelRef);

  // 2. Nothing to show: closed, or a collection without organizers.
  if (!open || !rules) return null;

  const title = wording?.panelTitle ?? DEFAULT_TITLE;
  const listDirection = layout === "m2" ? "horizontal" : "vertical";

  // 3. What the column holds decides the active card; 3D's limits win over the table of the profile.
  const column = selected ? viewSet?.columns.find(({ slot }) => slot === selected.slot) : undefined;
  const profileLimits = selected ? derived[organizerDrawerKey(selected)]?.profile : undefined;

  return (
    <aside ref={panelRef} className={clsx(s.panel, s[layout])} aria-label={title} data-layout={layout}>
      <h2 ref={titleRef} className={s.title} tabIndex={-1}>
        {title}
      </h2>
      {panel === "editor" ? (
        <PositionsEditor
          positionCount={profileLimits?.positionCount ?? rules.positionCount}
          value={draft ?? []}
          maxActive={profileLimits?.maxActive ?? rules.maxActive}
          layout={listDirection}
          pulse={savePulse}
          saving={busy}
          onToggle={(position) => editor.toggle(position)}
          onBack={editor.back}
          onSave={() => void editor.save()}
        />
      ) : (
        <PresetList
          cards={buildPresetCards(rules, wording)}
          activeId={column ? matchPreset(column.positions, rules.presets) : null}
          customizeLabel={wording?.customizeLabel ?? DEFAULT_CUSTOMIZE_LABEL}
          layout={listDirection}
          style={viewSet?.style}
          onSelect={(presetId) => void editor.applyPreset(presetId)}
          onCustomize={editor.openEditor}
          onRemove={() => void editor.remove()}
        />
      )}
    </aside>
  );
};
