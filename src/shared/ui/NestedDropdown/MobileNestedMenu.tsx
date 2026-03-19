import { useState } from "react";

import clsx from "clsx";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";
import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";

import type { DropdownItem } from "./NestedDropdown";
import s from "./MobileNestedMenu.module.scss";

type SelectedDimensions = {
  width?: number | null;
  depth?: number | null;
  height?: number | null;
};

interface MobileNestedMenuProps {
  items: DropdownItem[];
  onClose: () => void;
  title?: string;
  stepLabel?: string;
  stepValue?: string;
  previewLabel?: string | null;
  previewImage?: string | null;
  selectedDimensions?: SelectedDimensions;
  className?: string;
}

const renderItemTrail = (item: DropdownItem) => {
  if (item.children?.length) return <span className={s.chevron}>›</span>;
  if (item.trailing) return <span className={s.trailing}>{item.trailing}</span>;
  return null;
};

export const MobileNestedMenu = ({ items, onClose, className }: MobileNestedMenuProps) => {
  const [path, setPath] = useState<string[]>([]);

  const resolveTrail = (ids: string[]) => {
    const acc: DropdownItem[] = [];
    let currentItems = items;

    for (const id of ids) {
      const match = currentItems.find((item) => item.id === id);
      if (!match) break;
      acc.push(match);
      currentItems = match.children ?? [];
    }

    return acc;
  };

  const trail = resolveTrail(path);

  const currentItems = trail.length ? (trail[trail.length - 1]?.children ?? []) : items;
  const currentTitle = trail.length ? (trail[trail.length - 1]?.label ?? "Actions") : "Actions";
  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled) return;

    if (item.children?.length) {
      setPath((current) => [...current, item.id]);
      return;
    }

    item.onClick?.();
  };

  return (
    <div className={s.layer}>
      <div className={clsx(s.overlay, className)} role="dialog" aria-modal="true">
        <div className={s.content}>
          <div className={s.actionsPane}>
            <div className={s.actionsHeader}>
              {path.length ? (
                <button
                  type="button"
                  className={s.sectionBack}
                  onClick={() => setPath((current) => current.slice(0, -1))}
                >
                  <ArrowLeft width="16" height="16" fill="#282828" />
                  <span>{currentTitle}</span>
                </button>
              ) : (
                <span className={s.sectionTitle}>{currentTitle}</span>
              )}

              {!path.length && (
                <button type="button" className={s.closeButton} onClick={onClose} aria-label="Close menu">
                  <CloseIcon fill="#7c7c7c" />
                </button>
              )}
            </div>

            <div className={s.actionList}>
              {currentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx(s.actionItem, item.disabled && s.actionItemDisabled)}
                  onClick={() => handleItemClick(item)}
                  title={item.disabled && item.disabledReason ? item.disabledReason : undefined}
                >
                  <span className={s.actionLabel}>{item.label}</span>
                  <span className={s.actionTrail}>{renderItemTrail(item)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
