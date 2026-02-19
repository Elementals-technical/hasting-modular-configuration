import { type CSSProperties, type ReactNode, useRef, useState } from "react";

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

const CLOSE_DELAY = 50;

interface MenuItemProps {
  item: DropdownItem;
  renderItems: (list: DropdownItem[], isSub?: boolean) => ReactNode;
}

const MenuItem = ({ item, renderItems }: MenuItemProps) => {
  const hasChildren = Boolean(item.children?.length);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY);
  };

  return (
    <div
      className={clsx(s.item, hasChildren && s.hasChildren, isOpen && s.itemOpen)}
      onClick={() => {
        if (!hasChildren) item.onClick?.();
      }}
      onMouseEnter={() => {
        cancelClose();
        if (hasChildren) setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (hasChildren) scheduleClose();
      }}
    >
      <div className={s.left}>
        {item.icon && <span className={s.icon}>{item.icon}</span>}
        <span className={s.label}>{item.label}</span>
      </div>
      <div className={s.right}>
        {item.trailing && <span className={s.trailing}>{item.trailing}</span>}
        {hasChildren && <span className={s.caret}>›</span>}
      </div>

      {hasChildren && (
        <div
          className={clsx(s.subWrapper, isOpen && s.subWrapperOpen)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
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
