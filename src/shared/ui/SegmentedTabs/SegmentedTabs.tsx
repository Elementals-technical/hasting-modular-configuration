import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import s from "./SegmentedTabs.module.scss";

export type SegmentedTab = {
  value: string;
  label: string;
  /** A picture beside the label, an `svg` or `img`; the tab draws it 48 x 24. */
  icon?: ReactNode;
  disabled?: boolean;
};

type SegmentedTabsProps = {
  /** What the tabs choose between, for assistive technology. */
  label: string;
  tabs: readonly SegmentedTab[];
  value: string;
  onValueChange: (value: string) => void;
  /** A `SegmentedTabPanel` per tab. */
  children: ReactNode;
};

/**
 * Tabs drawn as one pill whose halves are the choices: the countertop level (Upper / Lower), the
 * panel a colour goes to. The chosen half is filled; its panel shows below.
 */
export const SegmentedTabs = ({ label, tabs, value, onValueChange, children }: SegmentedTabsProps) => {
  const change = (next: unknown) => {
    if (typeof next === "string" && tabs.some((tab) => tab.value === next)) onValueChange(next);
  };

  return (
    <Tabs.Root className={s.root} value={value} onValueChange={change}>
      <Tabs.List className={s.list} aria-label={label} activateOnFocus>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} className={s.tab} value={tab.value} disabled={tab.disabled}>
            <span>{tab.label}</span>
            {tab.icon}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className={s.indicator} />
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
};

type SegmentedTabPanelProps = {
  value: string;
  /** Keeps the panel in the page while another tab is chosen, with what the user did in it. */
  keepMounted?: boolean;
  children: ReactNode;
};

export const SegmentedTabPanel = ({ value, keepMounted, children }: SegmentedTabPanelProps) => (
  <Tabs.Panel className={s.panel} value={value} keepMounted={keepMounted}>
    {children}
  </Tabs.Panel>
);
