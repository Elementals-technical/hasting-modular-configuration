import { ProductStyleItem } from "@/shared/ui/ProductStyleItem/ProductStyleItem";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { getActiveCabinetType } from "../../model/store/selectors";

import s from "./ProductStyleGrid.module.scss";

interface ProductStyleGridI {
  data: {
    id: number;
    title: string;
    name?: string | undefined;
    desc?: string | undefined;
    isAvailable?: boolean;
    isShortDesc: boolean;
  }[];
  requiresActiveCabinet?: boolean;
  handleOpenStyleSidebar: () => void;
}

export const ProductStyleGrid: React.FC<ProductStyleGridI> = ({
  data,
  requiresActiveCabinet,
  handleOpenStyleSidebar,
}) => {
  const activeCabinet = useAppSelector(getActiveCabinetType);
  const hasActiveCabinet = activeCabinet !== null;

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
      {data.map((i) => (
        <ProductStyleItem key={i.id} id={i.id} title={i.title} handleOpenStyleSidebar={handleOpenStyleSidebar} />
      ))}
    </div>
  );
};
