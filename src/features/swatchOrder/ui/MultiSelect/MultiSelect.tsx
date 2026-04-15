import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIconSVG } from "../icons/ChevronDownIconSVG";
import { CloseIconSVG } from "../icons/CloseIconSVG";
import { CheckMarkIconSVG } from "../icons/CheckMarkIconSVG";
import s from "./MultiSelect.module.scss";

export interface IMultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectProps {
  options: IMultiSelectOption[];
  values: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  align?: "start" | "end";
}

const VIEWPORT_MARGIN = 8;

export const MultiSelect = ({
  options,
  values,
  onValueChange,
  placeholder = "Select",
  className,
  dropdownClassName,
  align = "start",
}: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOffset, setDropdownOffset] = useState(0);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const adjust = () => {
      const trigger = rootRef.current;
      const dd = dropdownRef.current;
      if (!trigger || !dd) return;
      const triggerRect = trigger.getBoundingClientRect();
      const ddRect = dd.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      let overflow = 0;
      if (align === "end") {
        const leftEdge = triggerRect.right - ddRect.width;
        if (leftEdge < VIEWPORT_MARGIN) overflow = VIEWPORT_MARGIN - leftEdge;
      } else {
        const rightEdge = triggerRect.left + ddRect.width;
        if (rightEdge > viewportWidth - VIEWPORT_MARGIN)
          overflow = viewportWidth - VIEWPORT_MARGIN - rightEdge;
      }
      setDropdownOffset(overflow);
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, [isOpen, align, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen]);

  const selectedCount = values.length;

  const displayContent = useMemo(() => {
    if (selectedCount === 0) return <span className={s.placeholder}>{placeholder}</span>;
    if (selectedCount === 1) {
      const opt = options.find((o) => o.value === values[0]);
      return <span className={s.selectedLabel}>{opt?.label ?? values[0]}</span>;
    }
    return (
      <span className={s.selectedMulti}>
        <span className={s.selectedLabel}>{placeholder}</span>
        <span className={s.counter} aria-hidden>
          {selectedCount}
        </span>
      </span>
    );
  }, [options, placeholder, selectedCount, values]);

  if (!options.length) return null;

  const toggleValue = (value: string, checked: boolean) => {
    if (checked) onValueChange([...values, value]);
    else onValueChange(values.filter((v) => v !== value));
  };

  return (
    <div ref={rootRef} className={`${s.root} ${className ?? ""}`.trim()}>
      <button
        type="button"
        className={`${s.trigger} ${isOpen ? s.triggerOpen : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={s.triggerLabel}>{displayContent}</span>
        <span className={`${s.chevron} ${isOpen ? s.chevronOpen : ""}`}>
          <ChevronDownIconSVG />
        </span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`${s.dropdown} ${align === "end" ? s.dropdownEnd : ""} ${dropdownClassName ?? ""}`}
          style={dropdownOffset ? { transform: `translateX(${dropdownOffset}px)` } : undefined}
        >
          {selectedCount > 0 && (
            <div className={s.dropdownHeader}>
              <button type="button" className={s.clearAllBtn} onClick={() => onValueChange([])}>
                <CloseIconSVG width={10} height={10} />
                <span>Clear all</span>
              </button>
            </div>
          )}

          <ul className={s.list} role="listbox">
            {options.map((option) => {
              const isChecked = values.includes(option.value);
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isChecked}
                  className={s.listItem}
                  onClick={() => toggleValue(option.value, !isChecked)}
                >
                  <span
                    className={`${s.checkbox} ${isChecked ? s.checkboxChecked : ""}`}
                    aria-hidden
                  >
                    {isChecked && <CheckMarkIconSVG width={12} height={9} />}
                  </span>
                  <span className={s.itemBody}>
                    <span className={s.itemLabel}>{option.label}</span>
                    {typeof option.count === "number" && (
                      <span className={s.itemCount}>{option.count}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
