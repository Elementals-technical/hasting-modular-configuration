import { ProductStyleItem } from "@/shared/ui/ProductStyleItem/ProductStyleItem";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { ROUTES } from "@/shared";

import { getActiveCabinetType, getSelectedDimensions } from "../../model/store/selectors";

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
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const hasActiveCabinet = activeCabinet !== null;

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
      {data.map((i) => {
        const isItemActive = isActive && activeStyleId === i.id;
        const detailsParams = new URLSearchParams();

        if (i.value) detailsParams.set("style", i.value);
        if (i.title) detailsParams.set("title", i.title);
        if (activeCabinet) detailsParams.set("cabinetType", activeCabinet);
        if (typeof selectedDimensions.height === "number") detailsParams.set("height", String(selectedDimensions.height));
        if (i.metadata?.image) detailsParams.set("image", i.metadata.image);

        const detailsTo = `${ROUTES.CUSTOM_CABINET_STYLE_DETAILS}?${detailsParams.toString()}`;

        return (
          <ProductStyleItem
            key={i.id}
            id={i.id}
            title={i.title}
            imageSrc={i.metadata?.image}
            detailsTo={detailsTo}
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
