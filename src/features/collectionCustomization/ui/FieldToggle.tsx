import type { FieldToggleState } from "@/entities/collection";

import s from "./FieldToggle.module.scss";

type FieldToggleProps = {
  toggle: FieldToggleState;
  onChange: (value: string) => void;
};

/**
 * The On / Off switch of a field that declares `toggle`, under the text ui.json gives it: a side
 * sets its value, the side already chosen nothing.
 */
export const FieldToggle = ({ toggle, onChange }: FieldToggleProps) => {
  const sides = [
    { label: "On", on: true, value: toggle.onValue },
    { label: "Off", on: false, value: toggle.offValue },
  ];

  return (
    <div className={s.field}>
      <p className={s.label}>{toggle.label}</p>
      <div className={s.toggle}>
        {sides.map(({ label, on, value }) => {
          const isChosen = toggle.on === on;

          return (
            <button
              key={label}
              type="button"
              className={`${s.side} ${isChosen ? s.chosen : ""}`}
              aria-pressed={isChosen}
              onClick={() => {
                if (!isChosen) onChange(value);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
