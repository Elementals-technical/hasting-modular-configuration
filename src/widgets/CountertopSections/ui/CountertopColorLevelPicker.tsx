import { useState, type ReactNode } from "react";

import type { FieldRuntimeState } from "@/entities/collection";
import { ColorField } from "@/features/collectionCustomization";
import { SegmentedTabPanel, SegmentedTabs, type SegmentedTab } from "@/shared/ui/SegmentedTabs/SegmentedTabs";

import LowerCountertopIcon from "../assets/lower-countertop.svg?react";
import UpperCountertopIcon from "../assets/upper-countertop.svg?react";

import s from "./CountertopSections.module.scss";

type Props = {
  children: ReactNode;
  lowerField: FieldRuntimeState;
  processing: boolean;
  error: string | null;
  onLowerChange: (color: string) => Promise<void>;
  onOrderSwatches: () => void;
};

type CountertopLevel = "upper" | "lower";

const CountertopLevelTabs = ({ children, lowerField, processing, error, onLowerChange, onOrderSwatches }: Props) => {
  const [level, setLevel] = useState<CountertopLevel>("upper");

  const changeLevel = (value: string) => {
    if (value === "upper" || value === "lower") setLevel(value);
  };

  const tabs: SegmentedTab[] = [
    {
      value: "upper",
      label: "Upper",
      disabled: processing,
      icon: <UpperCountertopIcon aria-hidden="true" focusable="false" />,
    },
    {
      value: "lower",
      label: "Lower",
      disabled: processing,
      icon: <LowerCountertopIcon aria-hidden="true" focusable="false" />,
    },
  ];

  return (
    <SegmentedTabs label="Countertop level" tabs={tabs} value={level} onValueChange={changeLevel}>
      <SegmentedTabPanel value="upper" keepMounted>
        {children}
      </SegmentedTabPanel>
      <SegmentedTabPanel value="lower" keepMounted>
        <fieldset className={s.lowerColors} disabled={processing} aria-busy={processing}>
          <ColorField
            field={lowerField}
            title="Lower Countertop Color"
            onChange={onLowerChange}
            onOrderSwatches={onOrderSwatches}
          />
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </SegmentedTabPanel>
    </SegmentedTabs>
  );
};

/** Upper keeps the existing basin controls; Lower edits only the composition-owned cover material. */
export const CountertopColorLevelPicker = (props: Props) => {
  if (!props.lowerField.visible) return <div>{props.children}</div>;

  return <CountertopLevelTabs {...props} />;
};
