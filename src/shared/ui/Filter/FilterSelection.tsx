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
  const [expandedCategory, setExpandedCategory] = useState<string | number | null>(null);
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
  const selectedLabel = showAllActive ? showAllLabel : selectedOption?.label ?? selectedOption?.name ?? label;

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
      setExpandedCategory(null);
      return;
    }

    const buttonEl = buttonRef.current;
    if (!buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 1000,
    });
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
    setExpandedCategory(null);
  };

  const handleCategoryClick = (option: Option) => {
    if (option.children && option.children.length > 0) {
      setExpandedCategory((prev) => (prev === option.value ? null : option.value));
    } else {
      handleSelect(option);
    }
  };

  const classes = className ? `${s.filterSelection} ${className}` : s.filterSelection;

  const renderOption = (option: Option, isChild = false) => {
    const hasChildren = option.children && option.children.length > 0;
    const isExpanded = expandedCategory === option.value;
    const isSelected = option.value === selectedValue;
    const isDisabled = Boolean(option.disabled);
    const optionLabel = option.label ?? option.name;
    const optionTitle = isDisabled ? option.reason : undefined;

    if (hasChildren) {
      return (
        <div key={option.value}>
          <button
            type="button"
            className={[s.menuItem, s.categoryItem, isExpanded ? s.categoryItemExpanded : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleCategoryClick(option)}
          >
            <span className={s.optionLabel}>{optionLabel}</span>
            <span className={`${s.caret} ${isExpanded ? s.caretUp : ""}`}>
              <ArrowDown width="8" />
            </span>
          </button>

          {isExpanded && (
            <div className={s.childrenGroup}>
              {option.children!.map((child) => renderOption(child, true))}
            </div>
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
