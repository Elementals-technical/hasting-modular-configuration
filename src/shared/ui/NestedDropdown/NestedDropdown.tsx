import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import clsx from "clsx";

import s from "./NestedDropdown.module.scss";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children?: DropdownItem[];
  onClick?: () => void;
}

interface NestedDropdownProps {
  items: DropdownItem[];
  className?: string;
  style?: CSSProperties;
}

export const NestedDropdown = ({ items, className, style }: NestedDropdownProps) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleClick = (item: DropdownItem) => {
    if (item.children && item.children.length > 0) {
      setOpenId(item.id);
      return;
    }
    item.onClick?.();
  };

  const renderItems = (list: DropdownItem[], isSub = false) => (
    <div className={clsx(s.menu, isSub && s.subMenu)}>
      {list.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={clsx(s.item, isOpen && hasChildren && s.active)}
            onMouseEnter={() => hasChildren && setOpenId(item.id)}
            onMouseLeave={() => hasChildren && setOpenId(null)}
            onClick={() => handleClick(item)}
          >
            <div className={s.left}>
              {item.icon && <span className={s.icon}>{item.icon}</span>}
              <span className={s.label}>{item.label}</span>
            </div>
            <div className={s.right}>
              {item.trailing && <span className={s.trailing}>{item.trailing}</span>}
              {hasChildren && <span className={s.caret}>›</span>}
            </div>

            {hasChildren && isOpen && (
              <div className={s.subWrapper}>{renderItems(item.children ?? [], true)}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={clsx(s.dropdown, className)} style={style}>
      {renderItems(items)}
    </div>
  );
};
