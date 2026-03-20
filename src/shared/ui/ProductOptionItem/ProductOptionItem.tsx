import color_img from "../../assets/images/png/img_png.png";
import none_img from "../../assets/images/png/none_img.png";
import { Hint } from "../Hint/Hint";

import { HintOptionIcon } from "@/shared/assets/images/svg/HintOptionIcon";
import { ExpandIcon } from "@/shared/assets/images/svg/ExpandIcon";
import type { ProductOptionMetadata } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import s from "./ProductOptionItem.module.scss";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;

  if (imagePath.startsWith("http")) return imagePath;

  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;

  return imagePath;
};

interface ProductOptionItemI {
  id: number | string;
  title: string;
  desc?: string | undefined;
  isAvailable?: boolean;
  disabledReason?: string;
  disabledActionLabel?: string;
  onDisabledAction?: () => void | Promise<void>;
  isMaterial?: boolean;
  name?: string;
  isShortDesc: boolean;
  config?: addProductConfigI;
  isActive?: boolean;
  onClick?: (name: string, config?: addProductConfigI) => void | Promise<void>;
  setActive?: (id: number | string) => void;
  metadata?: ProductOptionMetadata;
  onPreview?: (title: string, metadata?: ProductOptionMetadata) => void;
  variant?: "cabinetType";
}

export const ProductOptionItem: React.FC<ProductOptionItemI> = ({
  id,
  title,
  desc,
  isAvailable,
  disabledReason,
  disabledActionLabel,
  onDisabledAction,
  isShortDesc,
  name,
  config,
  isActive = false,
  isMaterial = false,
  onClick,
  setActive,
  metadata,
  onPreview,
  variant,
}) => {
  const available = isAvailable ?? true; // undefined as available
  const productName = name ?? title;
  const hasImage = !!metadata?.image;
  const hasHexColor = !!metadata?.hex;
  const hasVisual = hasImage || hasHexColor;
  const imageSrc = hasImage ? buildImageSrc(metadata?.image) : title !== "None" ? color_img : none_img;

  const optionContent = (
    <div
      className={`${s.productOption} ${isActive ? s.activeItem : ""} ${isMaterial ? s.materialOption : ""} ${variant === "cabinetType" ? s.cabinetTypeItem : ""} ${!available && variant === "cabinetType" ? s.disabledOption : ""}`}
      onClick={() => {
        if (!available) return;
        onClick?.(productName, config);
        setActive?.(id);
      }}
    >
      <div className={s.imageContainer}>
        <div className={`${s.image} ${hasVisual ? s.withVisual : ""} ${!available ? s.imageDisabled : ""}`}>
          {hasImage ? (
            <img src={imageSrc} alt="color image" />
          ) : hasHexColor ? (
            <div className={s.colorSwatch} style={{ backgroundColor: metadata?.hex }} />
          ) : (
            <img src={imageSrc} alt="color image" />
          )}
        </div>

        {onPreview && (
          <button
            className={s.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              onPreview(title, metadata);
            }}
          >
            <ExpandIcon />
          </button>
        )}
      </div>

      {available ? (
        <div className={`${s.title} ${s.titleHint}`}>
          {title}

          {isShortDesc && (
            <Hint
              className={s.optionHint_descr}
              placement="right"
              content={"Hint with dimensions & short description "}
            >
              <span className={s.descIcon}>
                <HintOptionIcon />
              </span>
            </Hint>
          )}
        </div>
      ) : (
        <>
          {variant === "cabinetType" ? (
            <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
          ) : (
            <Hint className={s.optionHint} content={disabledReason ?? "Not available for selected configuration"}>
              <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
            </Hint>
          )}
          {disabledActionLabel && onDisabledAction && (
            <button
              type="button"
              className={s.disabledAction}
              onClick={(e) => {
                e.stopPropagation();
                void onDisabledAction();
              }}
            >
              {disabledActionLabel}
            </button>
          )}
        </>
      )}

      <div className={s.desc}>{desc}</div>
    </div>
  );

  if (!available && variant === "cabinetType") {
    return (
      <Hint className={s.optionHint} content={disabledReason ?? "Not available for selected configuration"}>
        {optionContent}
      </Hint>
    );
  }

  return optionContent;
};
