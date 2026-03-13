import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowDown } from "@/shared/assets/images/svg/ArrowDown.tsx";

import s from "./FilterSelection.module.scss";

type Option = {
  label?: string | number;
  name?: string | number;
  value: string | number;
  disabled?: boolean;
  reason?: string;
  description?: string;
  children?: Option[];
};

type FilterSelectionProps = {
  label?: string;
  options?: Option[];
  value?: string | number;
  onSelect?: (value?: string | number) => void;
  className?: string;
  allowShowAll?: boolean;
  showAllLabel?: string;
};

const findOptionInTree = (options: Option[], targetValue: string | number): Option | undefined => {
  for (const option of options) {
    if (option.value === targetValue) return option;
    if (option.children) {
      const found = findOptionInTree(option.children, targetValue);
      if (found) return found;
    }
  }
  return undefined;
};

export const FilterSelection = ({
  label = "Size",
  options = [],
  value,
  onSelect,
  className,
  allowShowAll = false,
  showAllLabel = "Show all",
}: FilterSelectionProps) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | number | undefined>(value);
  const [expandedCategories, setExpandedCategories] = useState<Set<string | number>>(new Set());
  const [showAllSelected, setShowAllSelected] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedValue = value ?? internalValue;

  const selectedOption = useMemo(
    () => (selectedValue === undefined ? undefined : findOptionInTree(options, selectedValue)),
    [options, selectedValue],
  );
  const showAllActive = allowShowAll && showAllSelected;
  const selectedLabel = selectedOption?.label ?? selectedOption?.name ?? label;

  useEffect(() => {
    setInternalValue(value);
    if (value !== undefined) {
      setShowAllSelected(false);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (wrapperRef.current && wrapperRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;

      if (wrapperRef.current) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setExpandedCategories(new Set());
      return;
    }

    const buttonEl = buttonRef.current;
    if (!buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();
    const minMenuWidth = 164;
    const menuWidth = Math.max(rect.width, minMenuWidth);
    const overflows = rect.left + menuWidth > window.innerWidth;

    if (overflows) {
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
        width: rect.width,
        zIndex: 1000,
      });
    } else {
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
      });
    }
  }, [open]);

  const handleSelect = (option: Option) => {
    if (value === undefined) {
      setInternalValue(option.value);
    }

    setShowAllSelected(false);
    onSelect?.(option.value);
    setOpen(false);
  };

  const handleShowAll = () => {
    if (value === undefined) {
      setInternalValue(undefined);
    }

    setShowAllSelected(true);
    onSelect?.(undefined);
    setOpen(false);
    setExpandedCategories(new Set());
  };

  const handleCategoryClick = (option: Option) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);

      if (next.has(option.value)) {
        next.delete(option.value);
      } else {
        next.add(option.value);
      }

      return next;
    });
  };

  const classes = className ? `${s.filterSelection} ${className}` : s.filterSelection;

  const renderOption = (option: Option, isChild = false) => {
    const hasChildren = option.children && option.children.length > 0;
    const isExpanded = expandedCategories.has(option.value);
    const isSelected = option.value === selectedValue;
    const isDisabled = Boolean(option.disabled);
    const optionLabel = option.label ?? option.name;
    const optionTitle = isDisabled ? option.reason : undefined;

    if (hasChildren) {
      return (
        <div key={option.value}>
          <div
            className={[
              s.menuItem,
              s.categoryItem,
              isExpanded ? s.categoryItemExpanded : "",
              isSelected ? s.activeItem : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="option"
            aria-selected={isSelected}
          >
            <button type="button" className={s.categoryLabelBtn} onClick={() => handleSelect(option)}>
              <span className={s.optionLabel}>{optionLabel}</span>
            </button>
            <button
              type="button"
              className={s.categoryCaretBtn}
              aria-label={isExpanded ? `Collapse ${optionLabel}` : `Expand ${optionLabel}`}
              onClick={() => handleCategoryClick(option)}
            >
              <span className={`${s.caret} ${isExpanded ? s.caretUp : ""}`}>
                <ArrowDown width="8" />
              </span>
            </button>
          </div>

          {isExpanded && (
            <div className={s.childrenGroup}>{option.children!.map((child) => renderOption(child, true))}</div>
          )}
        </div>
      );
    }

    const itemClasses = [
      s.menuItem,
      isChild ? s.childItem : "",
      isSelected ? s.activeItem : "",
      isDisabled ? s.disabledItem : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={option.value}
        type="button"
        className={itemClasses}
        role="option"
        aria-selected={isSelected}
        disabled={isDisabled}
        title={optionTitle}
        onClick={() => handleSelect(option)}
      >
        <span className={s.optionLabel}>{optionLabel}</span>
        {option.description ? <span className={s.optionDescription}>{option.description}</span> : null}
        {isDisabled && option.reason ? <span className={s.optionReason}>{option.reason}</span> : null}
      </button>
    );
  };

  return (
    <div className={s.wrapper} ref={wrapperRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`${classes} ${open ? s.open : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={s.label}>{selectedLabel}</span>
        <span>
          <ArrowDown width="10" />
        </span>
      </button>

      {open && options.length > 0
        ? createPortal(
            <div
              className={s.menu}
              role="listbox"
              aria-label={label}
              style={menuStyle}
              ref={menuRef}
              data-filter-menu="true"
            >
              {allowShowAll ? (
                <button
                  type="button"
                  className={[s.menuItem, showAllActive ? s.activeItem : ""].filter(Boolean).join(" ")}
                  role="option"
                  aria-selected={showAllActive}
                  onClick={handleShowAll}
                >
                  <span className={s.optionLabel}>{showAllLabel}</span>
                </button>
              ) : null}
              {options.map((option) => renderOption(option))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};
