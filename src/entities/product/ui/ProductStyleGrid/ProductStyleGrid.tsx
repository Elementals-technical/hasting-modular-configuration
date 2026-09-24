import { ProductStyleItem } from "@/shared/ui/ProductStyleItem/ProductStyleItem";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { getActiveCabinetType, getSelectedDimensions } from "../../model/store/selectors";

import s from "./ProductStyleGrid.module.scss";

interface ProductStyleGridI {
  data: {
    /** The option value this card stands for; it is the card's identity. */
    value: string;
    title: string;
    name?: string | undefined;
    desc?: string | undefined;
    isAvailable?: boolean;
    /** Text a rule resolved itself; used while it names no reason code. */
    disabledReason?: string;
    /** Stable reason code; the interface resolves it (`shared/lib/reasonText`). */
    disabledReasonCode?: string;
    isMixingRestricted?: boolean;
    isShortDesc: boolean;
    metadata?: {
      image?: string;
    };
  }[];
  styleDetailsPath: string;
  requiresActiveCabinet?: boolean;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  activeValue?: string | null;
  onSelectStyle?: (value: string) => void;
  onMixingRestrictedSelect?: (value: string) => void;
}

export const ProductStyleGrid: React.FC<ProductStyleGridI> = ({
  data,
  styleDetailsPath,
  requiresActiveCabinet,
  handleOpenStyleSidebar,
  isActive = false,
  activeValue = null,
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
        const isItemActive = isActive && activeValue === i.value;
        const detailsParams = new URLSearchParams();

        detailsParams.set("style", i.value);
        if (i.title) detailsParams.set("title", i.title);
        if (activeCabinet) detailsParams.set("cabinetType", activeCabinet);
        if (typeof selectedDimensions.height === "number") detailsParams.set("height", String(selectedDimensions.height));

        const detailsTo = `${styleDetailsPath}?${detailsParams.toString()}`;

        return (
          <ProductStyleItem
            key={i.value}
            value={i.value}
            title={i.title}
            imageSrc={i.metadata?.image}
            detailsTo={detailsTo}
            handleOpenStyleSidebar={handleOpenStyleSidebar}
            isActive={isItemActive}
            isAvailable={i.isAvailable}
            disabledReason={i.disabledReason}
            disabledReasonCode={i.disabledReasonCode}
            isMixingRestricted={i.isMixingRestricted}
            onSelectStyle={onSelectStyle}
            onMixingRestrictedSelect={onMixingRestrictedSelect}
          />
        );
      })}
    </div>
  );
};
