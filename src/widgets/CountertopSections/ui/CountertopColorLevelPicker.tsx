import { Tabs } from "@base-ui/react/tabs";
import { useState, type ReactNode } from "react";

import type { FieldRuntimeState } from "@/entities/collection";
import { ColorField } from "@/features/collectionCustomization";

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

  const changeLevel = (value: unknown) => {
    if (value === "upper" || value === "lower") setLevel(value);
  };

  return (
    <Tabs.Root className={s.levelTabs} value={level} onValueChange={changeLevel}>
      <Tabs.List className={s.levelPicker} aria-label="Countertop level" activateOnFocus>
        <Tabs.Tab className={s.levelTab} value="upper" disabled={processing}>
          <span>Upper</span>
          <UpperCountertopIcon className={s.levelIcon} aria-hidden="true" focusable="false" />
        </Tabs.Tab>
        <Tabs.Tab className={s.levelTab} value="lower" disabled={processing}>
          <span>Lower</span>
          <LowerCountertopIcon className={s.levelIcon} aria-hidden="true" focusable="false" />
        </Tabs.Tab>
        <Tabs.Indicator className={s.levelIndicator} />
      </Tabs.List>
      <Tabs.Panel className={s.levelPanel} value="upper" keepMounted>
        {children}
      </Tabs.Panel>
      <Tabs.Panel className={s.levelPanel} value="lower" keepMounted>
        <fieldset className={s.lowerColors} disabled={processing} aria-busy={processing}>
          <ColorField
            field={lowerField}
            title="Lower Countertop Color"
            onChange={onLowerChange}
            onOrderSwatches={onOrderSwatches}
          />
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </Tabs.Panel>
    </Tabs.Root>
  );
};

/** Upper keeps the existing basin controls; Lower edits only the composition-owned cover material. */
export const CountertopColorLevelPicker = (props: Props) => {
  if (!props.lowerField.visible) return <div>{props.children}</div>;

  return <CountertopLevelTabs {...props} />;
};
