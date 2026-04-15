import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getIsAutofillEnabled,
  getSelectedMaterials,
} from "../../model/store/selectors";
import { removeItem, setAutofillEnabled } from "../../model/store/slice";
import { MAX_SLOTS } from "../../model/constants";
import { AttributeHelper } from "../../lib/AttributeHelper";
import { CheckMarkIconSVG } from "../icons/CheckMarkIconSVG";
import { CloseIconSVG } from "../icons/CloseIconSVG";
import s from "./SwatchesList.module.scss";

const AUTOFILL_TOOLTIP = "Let us fill your swatch cart with your selected finishes.";

export const SwatchesList = () => {
  const dispatch = useAppDispatch();
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const cartCount = selectedMaterials.reduce((sum, item) => sum + (item.count ?? 0), 0);
  const mockCount = Math.max(0, MAX_SLOTS - selectedMaterials.length);

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
          const key = `${val.metadata?.label ?? index}/${val.parentName}`;

          return (
            <div key={key} className={s.tileWrap}>
              <span
                className={s.tile}
                style={{
                  backgroundColor: image ? undefined : hex,
                  backgroundImage: image ? `url(${image})` : undefined,
                }}
                aria-label={label}
              />
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
        <span className={s.autofillInfo} tabIndex={0} aria-label={AUTOFILL_TOOLTIP} title={AUTOFILL_TOOLTIP}>
          i
          <span className={s.autofillTooltip} role="tooltip">
            {AUTOFILL_TOOLTIP}
          </span>
        </span>
      </label>
    </div>
  );
};
