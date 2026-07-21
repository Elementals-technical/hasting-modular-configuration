import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { type PresetProduct } from "@/entities/product/types";
import { CustomizeModePrompt } from "@/shared/ui/Popups/ui/CustomizeModePrompt/CustomizeModePrompt";

import { Hint } from "../Hint/Hint";

import s from "./ProductModelItem.module.scss";

const CUSTOMIZE_PROMPT_MEDIA_QUERY = "(max-width: 1024px)";

const getIsCompactCustomizeViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(CUSTOMIZE_PROMPT_MEDIA_QUERY).matches;

interface ProductModelGridI {
  id: number;
  title: string;
  img: string;
  desc?: string;
  isProductModel: boolean;
  price?: string;
  presetProducts?: PresetProduct[];
  onSelect: (presetProducts?: PresetProduct[], presetId?: number) => void;
  onCustomize?: (presetProducts?: PresetProduct[]) => void;
  isActive?: boolean;
}

export const ProductModelItem: React.FC<ProductModelGridI> = ({
  id,
  title,
  desc,
  img,
  isProductModel,
  price,
  onSelect,
  onCustomize,
  presetProducts,
  isActive,
}) => {
  const [isCustomizePromptOpen, setIsCustomizePromptOpen] = useState(false);
  const [isCompactCustomizeViewport, setIsCompactCustomizeViewport] = useState(getIsCompactCustomizeViewport);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(CUSTOMIZE_PROMPT_MEDIA_QUERY);
    const handleChange = () => setIsCompactCustomizeViewport(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const className = [s.productModelItem, isActive ? s.active : ""].filter(Boolean).join(" ");
  const handleDetailsClick = () => {
    const container = document.querySelector('[data-scroll-container="step-content"]');
    if (!(container instanceof HTMLElement)) return;

    sessionStorage.setItem("prebuilt:model:scrollTop", String(container.scrollTop));
    sessionStorage.setItem("prebuilt:model:restore-scroll", "1");
  };
  const handleSelect = () => onSelect(presetProducts, id);
  const customizePreset = () => {
    if (onCustomize) {
      onCustomize(presetProducts);
      return;
    }

    onSelect(presetProducts, id);
  };
  const handleCustomize = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (onCustomize && isCompactCustomizeViewport) {
      setIsCustomizePromptOpen(true);
      return;
    }

    customizePreset();
  };

  return (
    <div className={className}>
      <div className={s.optionImage} onClick={handleSelect}>
        {isCompactCustomizeViewport ? (
          <div className={s.innerButton} onClick={handleCustomize}>
            Customize
            <ArrowTopRight />
          </div>
        ) : (
          <Hint
            content="Switch to custom mode for full cabinet design control—add, remove, reposition cabinets and more"
            placement="top"
            trigger="hover"
          >
            <div className={s.innerButton} onClick={handleCustomize}>
              Customize
              <ArrowTopRight />
            </div>
          </Hint>
        )}
        <img src={img} alt="image" />
      </div>
      <div onClick={handleSelect} className={s.title}>
        {title}
      </div>
      {desc && <div className={s.desc}>{desc}</div>}

      {isProductModel && (
        <Link className={s.link} to={`/prebuilt/model/${id}`} onClick={handleDetailsClick}>
          <span>Product Details</span>
          <span className={s.linkIcon}>
            <ArrowTopRight color={"#ad5534"} />
          </span>
        </Link>
      )}
      {price && <div className={s.price}>{price}</div>}

      <CustomizeModePrompt
        isOpening={isCustomizePromptOpen}
        setIsOpening={setIsCustomizePromptOpen}
        onConfirm={customizePreset}
        title="Looking to further customize this model?"
        description="Switch to custom mode for full cabinet design control–add, remove, reposition cabinets and more"
      />
    </div>
  );
};
