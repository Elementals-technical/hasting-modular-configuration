import { useAppSelector } from "@/shared/hooks/store/redux";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

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
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({
  data,
  handleAdd,
  requiresActiveCabinet,
  setActiveCabinet,
  activeValue,
  activeValueSecondary,
  isLoading,
}) => {
  const activeCabinet = useAppSelector(getActiveCabinetType);
  const activeColor = useAppSelector(getCabinetColor);
  const activeBasinStyle = useAppSelector(getSinkType);

  const hasActiveCabinet = activeCabinet !== null;

  console.log("hasActiveCabinet", hasActiveCabinet);

  if (requiresActiveCabinet && !hasActiveCabinet) {
    return <div className={s.message}>Select cabinet type first</div>;
  }

  return (
    <div className={s.optionsGrid}>
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
          />
        );
      })}
    </div>
  );
};
