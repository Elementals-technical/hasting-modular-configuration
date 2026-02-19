import { type CSSProperties, type ReactNode } from "react";

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

interface MenuItemProps {
  item: DropdownItem;
  renderItems: (list: DropdownItem[], isSub?: boolean) => ReactNode;
}

const MenuItem = ({ item, renderItems }: MenuItemProps) => {
  const hasChildren = Boolean(item.children?.length);

  return (
    <div
      className={clsx(s.item, hasChildren && s.hasChildren)}
      onClick={() => {
        if (!hasChildren) item.onClick?.();
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
        <div className={s.subWrapper}>
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
