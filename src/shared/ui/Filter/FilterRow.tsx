import type { ReactNode } from "react";

import s from "./FilterRow.module.scss";

interface FilterRowI {
  className?: string;
  children: ReactNode;
}

export const FilterRow: React.FC<FilterRowI> = ({ children, className }) => {
  return <div className={`${className} ${s.filterRow}`}>{children}</div>;
};
