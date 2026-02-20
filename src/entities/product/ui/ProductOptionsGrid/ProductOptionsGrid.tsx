import { useState } from "react";
import clsx from "clsx";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";
import { MaterialPreviewModal } from "@/shared/ui/Popups/MaterialPreviewModal/MaterialPreviewModal";

import s from "./ProductOptionsGrid.module.scss";
import { getActiveCabinetType, getCabinetColor, getSinkType } from "../../model/store/selectors";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { LoaderBlock } from "@/shared/ui/LoaderBlock/LoaderBlock";

export type ProductOptionMetadata = {
  colors?: string[];
  materials?: string[];
  looks?: string[];
  hex?: string;
  value?: string;
  image?: string;
  sku?: string;
};

export type ProductOptionData = {
  id: number | string;
  title: string;
  name?: string;
  desc?: string;
  isAvailable?: boolean;
  isShortDesc: boolean;
  config?: addProductConfigI;
  metadata?: ProductOptionMetadata;
};

interface ProductOptionsGridI {
  data: ProductOptionData[];
  handleAdd?: (name: string) => void | Promise<void>;
  requiresActiveCabinet?: boolean;
  setActiveCabinet?: (code: string, name?: string) => void;
  activeValue?: string | number | null;
  activeValueSecondary?: string | number | null;
  isLoading?: boolean;
  variant?: "cabinetType";
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({
  data,
  handleAdd,
  requiresActiveCabinet,
  setActiveCabinet,
  activeValue,
  activeValueSecondary,
  isLoading,
  variant,
}) => {
  const activeCabinet = useAppSelector(getActiveCabinetType);
  const activeColor = useAppSelector(getCabinetColor);
  const activeBasinStyle = useAppSelector(getSinkType);

  const [previewItem, setPreviewItem] = useState<{ title: string; metadata?: ProductOptionMetadata } | null>(null);

  const hasActiveCabinet = activeCabinet !== null;

  console.log("hasActiveCabinet", hasActiveCabinet);

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={clsx(s.optionsGrid, variant === "cabinetType" && s.optionsGridCabinetType)}>
      {isLoading && <LoaderBlock />}

      {data.map((i) => {
        const playcanvasValue = i.metadata?.value ?? i.name ?? i.title ?? i.desc;
        const matchesCabinet =
          Boolean(setActiveCabinet) &&
          typeof activeCabinet === "string" &&
          activeCabinet.length > 0 &&
          activeCabinet === String(playcanvasValue);

        const hasExplicitActive = activeValue !== undefined || activeValueSecondary !== undefined;

        const matchesExplicit = activeValue === playcanvasValue || activeValueSecondary === playcanvasValue;

        const matchesDefault = activeColor === playcanvasValue || activeBasinStyle === playcanvasValue;

        const isActive = matchesCabinet || (hasExplicitActive ? matchesExplicit : matchesDefault);

        const handleSetActive = setActiveCabinet ? () => setActiveCabinet(String(playcanvasValue), i.name) : undefined;

        const isMaterial =
          (i.metadata?.materials?.length ?? 0) > 0 ||
          (i.metadata?.colors?.length ?? 0) > 0 ||
          !!i.metadata?.hex;

        return (
          <ProductOptionItem
            key={i.id}
            id={i.id}
            title={i.title}
            desc={i.desc}
            isAvailable={i.isAvailable}
            isShortDesc={i.isShortDesc}
            metadata={i.metadata}
            config={i.config}
            onClick={handleAdd}
            isActive={isActive}
            setActive={handleSetActive}
            name={playcanvasValue}
            isMaterial={isMaterial}
            onPreview={isMaterial ? (title, metadata) => setPreviewItem({ title, metadata }) : undefined}
          />
        );
      })}

      <MaterialPreviewModal
        isOpening={previewItem !== null}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.title ?? ""}
        metadata={previewItem?.metadata}
      />
    </div>
  );
};
