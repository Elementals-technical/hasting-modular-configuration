import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import clsx from "clsx";
import {
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartVertical,
  ChevronDown,
  ChevronUp,
  X,
  type LucideIcon,
} from "lucide-react";

import type { PlacementOverlayPoint } from "@/features/configuratorApi";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";

import { clampLength, formatInches, METRES_PER_INCH, metresToDisplayInches } from "../../lib/countertopLength";
import { placeDimensionPopover, type DimensionPopoverPlacement } from "./dimensionPopoverPlacement";

import s from "./CountertopDimensionPopover.module.scss";

/** Where the top keeps its place when its length changes. */
export type CountertopLengthAlign = "left" | "center" | "right";
export type CountertopDimensionRequest = { valueM: number; align?: CountertopLengthAlign };
type LimitsM = { minM: number; maxM: number };

const ALIGN_OPTIONS: readonly { value: CountertopLengthAlign; label: string; icon: LucideIcon }[] = [
  { value: "left", label: "Left", icon: AlignStartVertical },
  { value: "center", label: "Center", icon: AlignCenterVertical },
  { value: "right", label: "Right", icon: AlignEndVertical },
];

const STEP_IN = 1;

type Props = {
  /** "Length" or "Depth": the title, and the names of the field and of the popover. */
  label: string;
  /** The chip's centre, in overlay px. */
  anchor: PlacementOverlayPoint;
  /** The overlay `anchor` is measured in. */
  overlayRef: RefObject<HTMLElement>;
  valueM: number;
  /** Min / Max under the field and the stepper's bounds; without them the value only stays above 0. */
  limitsM?: LimitsM;
  /** Offers Align (Left / Center / Right) beside the field. */
  alignable?: boolean;
  onApply(request: CountertopDimensionRequest): void;
  onClose(): void;
};

/**
 * The popover of a countertop dimension chip (Length / Align, or Depth alone). It is portalled to
 * the body, above the page header that covers the top of the canvas on phones. While it is open a
 * transparent layer covers the page, so a press outside the popover closes it instead of moving the
 * top; Escape closes it too.
 */
export const CountertopDimensionPopover = ({
  label,
  anchor,
  overlayRef,
  valueM,
  limitsM,
  alignable = false,
  onApply,
  onClose,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const alignTitleId = useId();
  const [placement, setPlacement] = useState<DimensionPopoverPlacement | null>(null);
  const [valueIn, setValueIn] = useState(() => metresToDisplayInches(valueM));
  // The text being typed; null shows the formatted value. Focus keeps the field as it is, so a
  // selection made on focus (Tab selects the text) is replaced by what is typed.
  const [draft, setDraft] = useState<string | null>(null);
  const [align, setAlign] = useState<CountertopLengthAlign>("center");
  const name = label.toLowerCase();
  const limitsIn = limitsM
    ? { min: metresToDisplayInches(limitsM.minM), max: metresToDisplayInches(limitsM.maxM) }
    : null;

  useLayoutEffect(() => {
    const place = () => {
      const root = rootRef.current;
      const overlay = overlayRef.current?.getBoundingClientRect();
      if (!root || !overlay) return;
      setPlacement(
        placeDimensionPopover(
          { x: overlay.left + anchor.x, y: overlay.top + anchor.y },
          { width: root.offsetWidth, height: root.offsetHeight },
          // Across the canvas, as the design draws it; down the window, past a canvas too low for it.
          {
            left: Math.max(overlay.left, 0),
            right: Math.min(overlay.right, window.innerWidth),
            top: 0,
            bottom: window.innerHeight,
          },
        ),
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor.x, anchor.y, overlayRef]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  /** Inches as the chips show them (0.1″), within the limits; null for no value above 0. */
  const toValue = (inches: number) => {
    if (limitsM) return metresToDisplayInches(clampLength(inches * METRES_PER_INCH, limitsM));
    const shown = metresToDisplayInches(inches * METRES_PER_INCH);
    return shown > 0 ? shown : null;
  };
  /** What the field holds: the typed text if it reads as a value, else the last one. */
  const readValue = () => {
    if (draft === null) return valueIn;
    const typed = Number.parseFloat(draft.replace(",", "."));
    return (Number.isFinite(typed) ? toValue(typed) : null) ?? valueIn;
  };
  const commit = () => {
    const next = readValue();
    setValueIn(next);
    setDraft(null);
    return next;
  };
  const step = (deltaIn: number) => {
    const current = readValue();
    setValueIn(toValue(current + deltaIn) ?? current);
    setDraft(null);
  };
  const apply = () => {
    const nextM = commit() * METRES_PER_INCH;
    // Clamped in metres, so the one-cabinet minimum (23.6″) sends exactly 0.6 m.
    onApply({ valueM: limitsM ? clampLength(nextM, limitsM) : nextM, ...(alignable ? { align } : {}) });
  };

  return (
    <PortalBody>
      <div className={s.dismissLayer} aria-hidden="true" />
      <div
        ref={rootRef}
        className={clsx(s.popover, placement?.side === "below" && s.below)}
        style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? undefined : "hidden" }}
        role="dialog"
        aria-label={`Countertop ${name}`}
        data-testid="countertop-dimension-popover"
      >
        {placement && placement.side !== "over" && (
          <span className={s.tail} style={{ left: placement.tailLeft }} aria-hidden="true" />
        )}
        <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
          <AppIcon icon={X} size={20} />
        </button>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div className={s.columns}>
            <div className={s.fieldColumn}>
              <label className={s.title} htmlFor={inputId}>
                {label}
              </label>
              <div className={s.field}>
                <input
                  id={inputId}
                  className={s.input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  role="spinbutton"
                  aria-valuemin={limitsIn?.min}
                  aria-valuemax={limitsIn?.max}
                  aria-valuenow={valueIn}
                  aria-valuetext={formatInches(valueIn)}
                  value={draft ?? formatInches(valueIn)}
                  onBlur={commit}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    event.preventDefault();
                    step(event.key === "ArrowUp" ? STEP_IN : -STEP_IN);
                  }}
                />
                <div className={s.stepper}>
                  <button
                    type="button"
                    className={s.stepButton}
                    aria-label={`Increase ${name}`}
                    disabled={limitsIn !== null && valueIn >= limitsIn.max}
                    onClick={() => step(STEP_IN)}
                  >
                    <AppIcon icon={ChevronUp} size={16} />
                  </button>
                  <button
                    type="button"
                    className={s.stepButton}
                    aria-label={`Decrease ${name}`}
                    disabled={limitsIn !== null ? valueIn <= limitsIn.min : valueIn - STEP_IN <= 0}
                    onClick={() => step(-STEP_IN)}
                  >
                    <AppIcon icon={ChevronDown} size={16} />
                  </button>
                </div>
              </div>
              {limitsIn && (
                <div className={s.limits}>
                  <span>Min {formatInches(limitsIn.min)}</span>
                  <span>Max {formatInches(limitsIn.max)}</span>
                </div>
              )}
            </div>

            {alignable && (
              <div className={s.alignColumn} role="group" aria-labelledby={alignTitleId}>
                <span className={s.title} id={alignTitleId}>
                  Align
                </span>
                <div className={s.alignOptions}>
                  {ALIGN_OPTIONS.map(({ value, label: optionLabel, icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={s.alignOption}
                      aria-pressed={align === value}
                      onClick={() => setAlign(value)}
                    >
                      <AppIcon icon={icon} size={22} />
                      {optionLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className={s.apply}>
            Apply
          </button>
        </form>
      </div>
    </PortalBody>
  );
};
