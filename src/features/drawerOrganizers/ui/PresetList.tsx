import type { KeyboardEvent } from "react";
import { Settings2, Trash2 } from "lucide-react";

import type { PresetCardModel } from "../model/presets";

import { PresetCard } from "./PresetCard";

import s from "./DividerOptionsPanel.module.scss";

export type PresetListProps = {
  cards: PresetCardModel[];
  /** The preset the column matches (`matchPreset`), "custom" when none, null when nothing is selected. */
  activeId: string | "custom" | null;
  customizeLabel: string;
  layout: "vertical" | "horizontal";
  onSelect(id: string): void;
  onCustomize(): void;
  onRemove(): void;
  /** Material the schemes are drawn in; Metal by default. */
  style?: string;
};

const CUSTOM = "custom";
const CUSTOMIZE_CARD_ID = "customize";

/** Keys that move to the previous / next card: ↑ ↓ in a column, ← → in a row. */
const STEP_KEYS = {
  vertical: { previous: "ArrowUp", next: "ArrowDown" },
  horizontal: { previous: "ArrowLeft", next: "ArrowRight" },
} as const;

/**
 * The column's layout choices: [Customize] [Empty] [Preset 1..4] as a radiogroup, and Remove column below.
 * The arrows only move the focus (roving tabindex); Enter and Space click the focused card, which applies it.
 */
export const PresetList = ({
  cards,
  activeId,
  customizeLabel,
  layout,
  onSelect,
  onCustomize,
  onRemove,
  style,
}: PresetListProps) => {
  const customizeCard: PresetCardModel = { id: CUSTOMIZE_CARD_ID, label: customizeLabel, positions: [] };
  // Customize leads the list; the rest follow in the order the profile gives.
  const choiceIds = [CUSTOMIZE_CARD_ID, ...cards.map(({ id }) => id)];
  const checkedId = activeId === CUSTOM ? CUSTOMIZE_CARD_ID : activeId;
  // The one card in the tab order: the checked one, else the first.
  const tabStopId = checkedId !== null && choiceIds.includes(checkedId) ? checkedId : CUSTOMIZE_CARD_ID;
  const tabIndexOf = (id: string) => (id === tabStopId ? 0 : -1);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    // 1. Only the step keys of this layout move the focus.
    const keys = STEP_KEYS[layout];
    const step = event.key === keys.next ? 1 : event.key === keys.previous ? -1 : 0;
    if (step === 0) return;

    // 2. The radios in DOM order; the one with the focus decides where to go (wrapping around).
    const choices = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
    const current = choices.findIndex((choice) => choice === document.activeElement);
    if (current === -1) return;

    event.preventDefault();
    choices[(current + step + choices.length) % choices.length].focus();
  };

  return (
    <div className={s.presetList} data-layout={layout}>
      <div className={s.cards} role="radiogroup" aria-label="Column layout" onKeyDown={moveFocus}>
        <PresetCard
          card={customizeCard}
          active={checkedId === CUSTOMIZE_CARD_ID}
          sublabel={activeId === CUSTOM ? "Custom" : undefined}
          illustration={<Settings2 className={s.customizeIcon} aria-hidden="true" />}
          tabIndex={tabIndexOf(CUSTOMIZE_CARD_ID)}
          onClick={onCustomize}
        />
        {cards.map((card) => (
          <PresetCard
            key={card.id}
            card={card}
            active={checkedId === card.id}
            style={style}
            tabIndex={tabIndexOf(card.id)}
            onClick={() => onSelect(card.id)}
          />
        ))}
      </div>
      <button type="button" className={s.removeButton} onClick={onRemove}>
        <Trash2 size={16} aria-hidden="true" />
        <span>Remove column</span>
      </button>
    </div>
  );
};
