import { useAppSelector } from "@/shared/hooks/store/redux";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

import s from "./ProductOptionsGrid.module.scss";
import { getActiveCabinetType, getCabinetColor } from "../../model/store/selectors";

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
  setActiveCabinet?: (id: number) => void;
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({
  data,
  handleAdd,
  requiresActiveCabinet,
  setActiveCabinet,
}) => {
  const activeCabinet = useAppSelector(getActiveCabinetType);
  const activeColor = useAppSelector(getCabinetColor);

  const hasActiveCabinet = activeCabinet !== null;

  console.log("hasActiveCabinet", hasActiveCabinet);

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
      {data.map((i) => {
        const optionName = i.name ?? i.desc ?? i.title;
        const isActive = activeCabinet === i.id || activeColor === optionName;

        return (
          <ProductOptionItem
            key={i.id}
            id={i.id}
            name={optionName}
            title={i.title}
            desc={i.desc}
            isAvailable={i.isAvailable}
            isShortDesc={i.isShortDesc}
            onClick={handleAdd}
            isActive={isActive}
            setActive={setActiveCabinet}
          />
        );
      })}
    </div>
  );
};
