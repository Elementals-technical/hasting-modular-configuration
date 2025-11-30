import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowDown } from "@/shared/assets/images/svg/ArrowDown.tsx";

import s from "./FilterSelection.module.scss";

type Option = {
  label: string;
  value: string;
};

type FilterSelectionProps = {
  label?: string;
  options?: Option[];
  value?: string;
  onSelect?: (value: string) => void;
  className?: string;
};

export const FilterSelection = ({ label = "Size", options = [], value, onSelect, className }: FilterSelectionProps) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | undefined>(value);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedValue = value ?? internalValue;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue],
  );

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        className={`${classes} ${open ? s.open : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={s.label}>{selectedOption?.label ?? label}</span>
        <span>
          <ArrowDown />
        </span>
      </button>

      {open && options.length > 0 ? (
        <div className={s.menu} role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === selectedValue;

            return (
              <button
                key={option.value}
                type="button"
                className={`${s.menuItem} ${isSelected ? s.activeItem : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
