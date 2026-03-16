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
    disabledReason?: string;
    isMixingRestricted?: boolean;
    isShortDesc: boolean;
    value?: string;
    metadata?: {
      image?: string;
    };
  }[];
  requiresActiveCabinet?: boolean;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  activeStyleId?: number | null;
  onSelectStyle?: (id: number) => void;
  onMixingRestrictedSelect?: (id: number) => void;
}

export const ProductStyleGrid: React.FC<ProductStyleGridI> = ({
  data,
  requiresActiveCabinet,
  handleOpenStyleSidebar,
  isActive = false,
  activeStyleId = null,
  onSelectStyle,
  onMixingRestrictedSelect,
}) => {
  const activeCabinet = useAppSelector(getActiveCabinetType);
  const hasActiveCabinet = activeCabinet !== null;

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
      {data.map((i) => {
        const isItemActive = isActive && activeStyleId === i.id;

        return (
          <ProductStyleItem
            key={i.id}
            id={i.id}
            title={i.title}
            imageSrc={i.metadata?.image}
            handleOpenStyleSidebar={handleOpenStyleSidebar}
            isActive={isItemActive}
            isAvailable={i.isAvailable}
            disabledReason={i.disabledReason}
            isMixingRestricted={i.isMixingRestricted}
            onSelectStyle={onSelectStyle}
            onMixingRestrictedSelect={onMixingRestrictedSelect}
          />
        );
      })}
    </div>
  );
};
