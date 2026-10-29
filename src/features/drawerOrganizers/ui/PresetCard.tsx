import type { ReactNode } from "react";
import clsx from "clsx";

import type { PresetCardModel } from "../model/presets";

import { ColumnSchematic } from "./ColumnSchematic";

import s from "./DividerOptionsPanel.module.scss";

/** The scheme is sized by the card's stylesheet (it differs per panel layout); this is its fallback height. */
const SCHEMATIC_FALLBACK_SIZE_PX = 72;

export type PresetCardProps = {
  card: PresetCardModel;
  active: boolean;
  /** A second line under the label ("Custom" on the Customize card). */
  sublabel?: string;
  onClick(): void;
  /** Material the scheme is drawn in; Oak is off in v1, so Metal by default. */
  style?: string;
  /** Replaces the scheme (the Customize card shows an icon). */
  illustration?: ReactNode;
  /** The radiogroup keeps one card in the tab order (roving tabindex). */
  tabIndex?: number;
};

/** One choice of the preset list: a radio with the column scheme and its label. */
export const PresetCard = ({
  card,
  active,
  sublabel,
  onClick,
  style = "Metal",
  illustration,
  tabIndex,
}: PresetCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    tabIndex={tabIndex}
    className={clsx(s.card, active && s.cardActive)}
    data-preset-id={card.id}
    onClick={onClick}
  >
    <span className={s.cardArt}>
      {illustration ?? <ColumnSchematic positions={card.positions} style={style} size={SCHEMATIC_FALLBACK_SIZE_PX} />}
    </span>
    <span className={s.cardLabel}>{card.label}</span>
    {sublabel && <span className={s.cardSublabel}>{sublabel}</span>}
  </button>
);
