import { useRef, useState, type CSSProperties, type ReactNode } from "react";

import clsx from "clsx";

import s from "./NestedDropdown.module.scss";
import { ArrowRightNestedIcon } from "@/shared/assets/images/svg/ArrowRightNestedIcon";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children?: DropdownItem[];
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  checked?: boolean;
}

interface NestedDropdownProps {
  items: DropdownItem[];
  className?: string;
  style?: CSSProperties;
}

interface MenuItemProps {
  item: DropdownItem;
  renderItems: (list: DropdownItem[], isSub?: boolean) => ReactNode;
}

const MenuItem = ({ item, renderItems }: MenuItemProps) => {
  const hasChildren = Boolean(item.children?.length);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuTop, setSubmenuTop] = useState(0);

  return (
    <div
      onMouseEnter={(event) => {
        if (!hasChildren || !submenuRef.current) return;
        const top = event.currentTarget.getBoundingClientRect().top;
        setSubmenuTop(Math.min(0, window.innerHeight - top - submenuRef.current.offsetHeight - 8));
      }}
      role={item.checked !== undefined ? "checkbox" : undefined}
      aria-checked={item.checked}
      tabIndex={item.checked !== undefined ? 0 : undefined}
      onKeyDown={(event) => {
        if (item.checked !== undefined && (event.key === " " || event.key === "Enter")) {
          event.preventDefault();
          if (!item.disabled) item.onClick?.();
        }
      }}
      className={clsx(s.item, hasChildren && s.hasChildren, item.disabled && s.disabled)}
      title={item.disabled && item.disabledReason ? item.disabledReason : undefined}
      onClick={() => {
        if (item.disabled) return;
        if (!hasChildren) item.onClick?.();
      }}
    >
      <div className={s.left}>
        {item.icon && <span className={s.icon}>{item.icon}</span>}
        <span className={s.label}>{item.label}</span>
      </div>
      <div className={s.right}>
        {item.trailing && <span className={s.trailing}>{item.trailing}</span>}
        {hasChildren && (
          <span className={s.caret}>
            <ArrowRightNestedIcon />
          </span>
        )}
      </div>

      {hasChildren && (
        <div ref={submenuRef} className={s.subWrapper} style={{ top: submenuTop }}>
          {renderItems(item.children ?? [], true)}
        </div>
      )}
    </div>
  );
};

export const NestedDropdown = ({ items, className, style }: NestedDropdownProps) => {
  const renderItems = (list: DropdownItem[], isSub = false): ReactNode => (
    <div className={clsx(s.menu, isSub && s.subMenu)}>
      {list.map((item) => (
        <MenuItem key={item.id} item={item} renderItems={renderItems} />
      ))}
    </div>
  );

  return (
    <div className={clsx(s.dropdown, className)} style={style}>
      {renderItems(items)}
    </div>
  );
};
