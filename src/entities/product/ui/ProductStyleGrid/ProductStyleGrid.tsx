import type { To } from "react-router-dom";

import { ProductStyleItem } from "@/shared/ui/ProductStyleItem/ProductStyleItem";
import { useAppSelector } from "@/shared/hooks/store/redux";
import type { MessageParams } from "@/shared/lib/reasonText";

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
    disabledReasonParams?: MessageParams;
    isMixingRestricted?: boolean;
    isShortDesc: boolean;
    metadata?: {
      image?: string;
    };
    /**
     * The heading the card stands under, where a collection offers the styles of several series
     * (Urban Duplex beside Urban Standard). Cards keep their order; one heading alone is not shown.
     */
    group?: string;
    /** What the card's details are asked with, over the card's own query. */
    detailsQuery?: Record<string, string>;
  }[];
  /** The address of a style's details for its query, in the collection of the session. */
  detailsTo: (query: string) => To;
  requiresActiveCabinet?: boolean;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  activeValue?: string | null;
  onSelectStyle?: (value: string) => void;
  onMixingRestrictedSelect?: (value: string) => void;
}

export const ProductStyleGrid: React.FC<ProductStyleGridI> = ({
  data,
  detailsTo,
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

  const renderItem = (i: ProductStyleGridI["data"][number]) => {
    const isItemActive = isActive && activeValue === i.value;
    const detailsParams = new URLSearchParams();

    detailsParams.set("style", i.value);
    if (i.title) detailsParams.set("title", i.title);
    if (activeCabinet) detailsParams.set("cabinetType", activeCabinet);
    if (typeof selectedDimensions.height === "number") detailsParams.set("height", String(selectedDimensions.height));
    Object.entries(i.detailsQuery ?? {}).forEach(([key, value]) => detailsParams.set(key, value));

    return (
      <ProductStyleItem
        key={i.value}
        value={i.value}
        title={i.title}
        imageSrc={i.metadata?.image}
        detailsTo={detailsTo(detailsParams.toString())}
        handleOpenStyleSidebar={handleOpenStyleSidebar}
        isActive={isItemActive}
        isAvailable={i.isAvailable}
        disabledReason={i.disabledReason}
        disabledReasonCode={i.disabledReasonCode}
        disabledReasonParams={i.disabledReasonParams}
        isMixingRestricted={i.isMixingRestricted}
        onSelectStyle={onSelectStyle}
        onMixingRestrictedSelect={onMixingRestrictedSelect}
      />
    );
  };

  const groups = [...new Set(data.map((i) => i.group ?? ""))];

  if (groups.length < 2) {
    return <div className={s.optionsGrid}>{data.map(renderItem)}</div>;
  }

  return (
    <div>
      {groups.map((group) => (
        <section key={group} className={s.groupSection}>
          {group && <div className={s.groupTitle}>{group}</div>}
          <div className={s.optionsGrid}>{data.filter((i) => (i.group ?? "") === group).map(renderItem)}</div>
        </section>
      ))}
    </div>
  );
};
