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
};

type FilterSelectionProps = {
  label?: string;
  options?: Option[];
  value?: string | number;
  onSelect?: (value: string | number) => void;
  className?: string;
};

export const FilterSelection = ({ label = "Size", options = [], value, onSelect, className }: FilterSelectionProps) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | number | undefined>(value);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedValue = value ?? internalValue;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue],
  );
  const selectedLabel = selectedOption?.label ?? selectedOption?.name ?? label;

  useEffect(() => {
    setInternalValue(value);
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
    if (!open) return;

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

    onSelect?.(option.value);
    setOpen(false);
  };

  const classes = className ? `${s.filterSelection} ${className}` : s.filterSelection;

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
              {options.map((option) => {
                const isSelected = option.value === selectedValue;
                const isDisabled = Boolean(option.disabled);
                const optionLabel = option.label ?? option.name;

                const optionTitle = isDisabled ? option.reason : undefined;
                const classes = [s.menuItem, isSelected ? s.activeItem : "", isDisabled ? s.disabledItem : ""]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={classes}
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
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};
