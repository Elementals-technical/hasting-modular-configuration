import { MaterialsFilter } from "./MaterialsFilter";
import { ColorsFilter } from "./ColorsFilter";
import { LooksFilter } from "./LooksFilter";
import s from "./Filters.module.scss";

export const Filters = () => (
  <div className={s.row}>
    <MaterialsFilter />
    <ColorsFilter />
    <LooksFilter />
  </div>
);
