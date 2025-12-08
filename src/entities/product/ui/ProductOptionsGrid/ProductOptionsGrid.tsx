import { setActiveCabinetType } from "@/entities/product/model/store/slice";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

import s from "./ProductOptionsGrid.module.scss";
import { getActiveCabinetType } from "../../model/store/selectors";

interface ProductOptionsGridI {
  data: {
    id: number;
    title: string;
    name?: string | undefined;
    desc?: string | undefined;
    isAvailable?: boolean;
    isShortDesc: boolean;
  }[];
  handleAdd?: (name?: string) => void | Promise<void>;
  requiresActiveCabinet?: boolean;
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({ data, handleAdd, requiresActiveCabinet }) => {
  const dispatch = useAppDispatch();

  const activeCabinet = useAppSelector(getActiveCabinetType);
  const hasActiveCabinet = activeCabinet !== null;

  console.log("hasActiveCabinet", hasActiveCabinet);

  const setActiveCabinet = (id: number) => {
    console.log(id);

    dispatch(setActiveCabinetType(id));
  };

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
      {data.map((i) => (
        <ProductOptionItem
          key={i.id}
          id={i.id}
          name={i.name}
          title={i.title}
          desc={i.desc}
          isAvailable={i.isAvailable}
          isShortDesc={i.isShortDesc}
          onClick={handleAdd}
          setActive={setActiveCabinet}
        />
      ))}
    </div>
  );
};
