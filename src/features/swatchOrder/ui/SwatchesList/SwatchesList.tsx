import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getIsAutofillEnabled,
  getSelectedMaterials,
} from "../../model/store/selectors";
import { removeItem, setAutofillEnabled } from "../../model/store/slice";
import { MAX_SLOTS } from "../../model/constants";
import { AttributeHelper } from "../../lib/AttributeHelper";
import { getSwatchIdentity } from "../../lib/getSwatchIdentity";
import { CheckMarkIconSVG } from "../icons/CheckMarkIconSVG";
import { CloseIconSVG } from "../icons/CloseIconSVG";
import s from "./SwatchesList.module.scss";

const AUTOFILL_TOOLTIP = "Let us fill your swatch cart with your selected finishes.";

export const SwatchesList = () => {
  const dispatch = useAppDispatch();
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const [isAutofillTooltipOpen, setIsAutofillTooltipOpen] = useState(false);
  const tooltipWrapRef = useRef<HTMLDivElement | null>(null);
  const cartCount = selectedMaterials.reduce((sum, item) => sum + (item.count ?? 0), 0);
  const mockCount = Math.max(0, MAX_SLOTS - selectedMaterials.length);

  useEffect(() => {
    if (!isAutofillTooltipOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && tooltipWrapRef.current?.contains(target)) return;
      setIsAutofillTooltipOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAutofillTooltipOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAutofillTooltipOpen]);

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.titleWrap}>
          <span className={s.title}>Swatches list</span>
          <span className={s.free}>Free</span>
        </div>
        <div className={s.count}>
          {cartCount}/{MAX_SLOTS} Selected
        </div>
      </div>

      <div className={s.tiles}>
        {selectedMaterials.map((val, index) => {
          const image = AttributeHelper.getImage(val);
          const hex = AttributeHelper.getHexColor(val) ?? "#e5e5e5";
          const label = AttributeHelper.getValueLabel(val);
          const materialLabel = AttributeHelper.getMaterialDisplayName(val);
          const tooltipLabel = materialLabel ? `${label} ${materialLabel}` : label;
          const key = getSwatchIdentity(val);

          return (
            <div key={key} className={s.tileWrap}>
              <span
                className={s.tile}
                style={{
                  backgroundColor: image ? undefined : hex,
                  backgroundImage: image ? `url(${image})` : undefined,
                }}
                tabIndex={0}
                aria-label={tooltipLabel}
                aria-describedby={`swatch-tooltip-${index}`}
              />
              <span id={`swatch-tooltip-${index}`} className={s.tileTooltip} role="tooltip">
                <span>{label}</span>
                {materialLabel && <span className={s.tileTooltipAcronym}>{materialLabel}</span>}
              </span>

              <button
                type="button"
                className={s.removeBtn}
                onClick={() => dispatch(removeItem({ selectedMaterial: val }))}
                aria-label={`Remove ${label}`}
              >
                <CloseIconSVG width={8} height={8} />
              </button>
            </div>
          );
        })}

        {Array.from({ length: mockCount }).map((_, i) => (
          <span key={`mock-${i}`} className={`${s.tile} ${s.tileEmpty}`} aria-hidden />
        ))}
      </div>

      <div className={s.autofillControls}>
        <label className={s.autofillRow}>
          <input
            type="checkbox"
            className={s.autofillInput}
            checked={isAutofillEnabled}
            onChange={(event) => dispatch(setAutofillEnabled(event.target.checked))}
          />
          <span
            className={`${s.autofillBox} ${isAutofillEnabled ? s.autofillBoxChecked : ""}`}
            aria-hidden
          >
            {isAutofillEnabled && <CheckMarkIconSVG width={10} height={8} />}
          </span>
          <span className={s.autofillLabel}>Autofill My Swatches</span>
        </label>

        <div ref={tooltipWrapRef} className={s.autofillInfoWrap}>
          <button
            type="button"
            className={`${s.autofillInfo} ${isAutofillTooltipOpen ? s.autofillInfoOpen : ""}`}
            aria-label={AUTOFILL_TOOLTIP}
            aria-expanded={isAutofillTooltipOpen}
            aria-describedby="autofill-swatches-tooltip"
            onClick={() => setIsAutofillTooltipOpen((value) => !value)}
          >
            i
          </button>
          <span
            id="autofill-swatches-tooltip"
            className={`${s.autofillTooltip} ${isAutofillTooltipOpen ? s.autofillTooltipOpen : ""}`}
            role="tooltip"
          >
            {AUTOFILL_TOOLTIP}
          </span>
        </div>
      </div>
    </div>
  );
};
