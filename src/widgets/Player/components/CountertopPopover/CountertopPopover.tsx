import { useEffect, useMemo, useState } from "react";

import clsx from "clsx";

import type { DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";

import s from "./CountertopPopover.module.scss";

export type CountertopPopoverProps = {
  items: DropdownItem[];
  selectedByCategory?: Record<string, string | null | undefined>;
  className?: string;
  onCtaClick?: (activeCategoryId: string | null) => void;
};

const resolveHeaderLabel = (label: string) => {
  if (!label) return "Select";
  return label.toLowerCase().startsWith("select ") ? label : `Select ${label}`;
};

const resolveCtaLabel = (label: string) => {
  if (!label) return "Select";

  if (label.toLowerCase().includes("style")) return "Select Style";
  if (label.toLowerCase().includes("color")) return "Select Color";

  return "Select";
};

export const CountertopPopover = ({
  items,
  selectedByCategory = {},
  className,
  onCtaClick,
}: CountertopPopoverProps) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (!items.length) {
      setActiveCategoryId(null);
      return;
    }

    if (!activeCategoryId || !items.some((item) => item.id === activeCategoryId)) {
      setActiveCategoryId(items[0]?.id ?? null);
    }
  }, [activeCategoryId, items]);

  const activeCategory = useMemo(
    () => items.find((item) => item.id === activeCategoryId) ?? items[0] ?? null,
    [activeCategoryId, items],
  );

  const options = activeCategory?.children ?? [];
  const selectedId = activeCategory ? (selectedByCategory[activeCategory.id] ?? null) : null;

  return (
    <div className={clsx(s.popover, className)}>
      <div className={s.leftColumn}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={clsx(
              s.leftItem,
              item.id === activeCategory?.id && s.leftItemActive,
              index > 0 && s.leftItemDivider,
            )}
            onClick={() => setActiveCategoryId(item.id)}
          >
            <span className={s.leftLabel}>{item.label}</span>
            <span className={s.leftCaret}>›</span>
          </button>
        ))}
      </div>

      <div className={s.rightColumn}>
        <div className={s.header}>{resolveHeaderLabel(activeCategory?.label ?? "")}</div>
        <div className={s.optionsList}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={clsx(s.optionItem, option.id === selectedId && s.optionItemActive)}
              onClick={() => option.onClick?.()}
            >
              <div className={s.optionLeft}>
                {option.icon && <div className={s.optionPreview}>{option.icon}</div>}
                <div className={s.optionLabel}>{option.label}</div>
              </div>
              <div className={s.optionRight}>›</div>
            </button>
          ))}
        </div>
        <button type="button" className={s.ctaButton} onClick={() => onCtaClick?.(activeCategory?.id ?? null)}>
          {resolveCtaLabel(activeCategory?.label ?? "")}
        </button>
      </div>
    </div>
  );
};
