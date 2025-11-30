import type { ReactNode } from "react";

import s from "./FilterRow.module.scss";

interface FilterRowI {
  children: ReactNode;
}

export const FilterRow: React.FC<FilterRowI> = ({ children }) => {
  return <div className={s.filterRow}>{children}</div>;
};
