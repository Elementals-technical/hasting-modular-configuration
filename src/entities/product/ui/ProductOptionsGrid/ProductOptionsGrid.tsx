import { useAppSelector } from "@/shared/hooks/store/redux";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

import s from "./ProductOptionsGrid.module.scss";
import { getActiveCabinetType, getCabinetColor } from "../../model/store/selectors";

type ProductOptionData = {
  id: number | string;
  title: string;
  name?: string;
  desc?: string;
  isAvailable?: boolean;
  isShortDesc: boolean;
};

interface ProductOptionsGridI {
  data: ProductOptionData[];
  handleAdd?: (name: string) => void | Promise<void>;
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
        const optionName = i.title ?? i.desc ?? i.name;
        const matchesCabinet = typeof i.id === "number" && activeCabinet === i.id;

        const isActive = matchesCabinet || activeColor === optionName;

        const handleSetActive =
          typeof i.id === "number" && setActiveCabinet
            ? (id: string | number) => setActiveCabinet(id as number)
            : undefined;

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
            setActive={handleSetActive}
          />
        );
      })}
    </div>
  );
};
