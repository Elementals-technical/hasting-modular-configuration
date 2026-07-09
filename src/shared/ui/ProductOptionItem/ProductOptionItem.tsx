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
  disabledBadgeLabel?: string;
  disabledActionLabel?: string;
  onDisabledAction?: () => void | Promise<void>;
  isMaterial?: boolean;
  name?: string;
  isShortDesc: boolean;
  config?: addProductConfigI;
  isActive?: boolean;
  onClick?: (name: string, config?: addProductConfigI, metadata?: ProductOptionMetadata) => void | Promise<void>;
  setActive?: (id: number | string) => void;
  metadata?: ProductOptionMetadata;
  onPreview?: (title: string, metadata?: ProductOptionMetadata) => void;
  variant?: "cabinetType" | "accessory";
}

export const ProductOptionItem: React.FC<ProductOptionItemI> = ({
  id,
  title,
  desc,
  isAvailable,
  disabledReason,
  disabledBadgeLabel,
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
  const isLightHex = hasHexColor && /^#?(f{3}|f{6})$/i.test(metadata!.hex!.trim());
  const needsLightBorder = isLightHex || metadata?.lightBorder === true;
  const imageSrc = hasImage ? buildImageSrc(metadata?.image) : title !== "None" ? color_img : none_img;
  const isCabinetTypeVariant = variant === "cabinetType";
  const isAccessoryVariant = variant === "accessory";
  const isSinkBaseCabinetType = isCabinetTypeVariant && productName === "Sink-Base";
  const isSideCabinetType =
    isCabinetTypeVariant && (productName === "Sink-Cabinet" || productName === "Side-Cabinet");

  const optionContent = (
    <div
      className={`${s.productOption} ${isActive ? s.activeItem : ""} ${isMaterial ? s.materialOption : ""} ${isCabinetTypeVariant ? s.cabinetTypeItem : ""} ${isAccessoryVariant ? s.accessoryItem : ""} ${isSinkBaseCabinetType ? s.sinkBaseCabinetTypeItem : ""} ${isSideCabinetType ? s.sideCabinetTypeItem : ""} ${!available ? s.disabledOption : ""}`}
      onClick={() => {
        if (!available) return;
        onClick?.(productName, config, metadata);
        setActive?.(id);
      }}
    >
      <div className={s.imageContainer}>
        <div
          className={`${s.image} ${hasVisual ? s.withVisual : ""} ${!available ? s.imageDisabled : ""} ${needsLightBorder ? s.lightBorder : ""}`}
        >
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
          <div className={s.disabledTitleRow}>
            <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
            {disabledBadgeLabel && <span className={s.disabledBadge}>{disabledBadgeLabel}</span>}
          </div>
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

  if (!available) {
    return (
      <Hint className={s.optionHint} content={disabledReason ?? "Not available for selected configuration"}>
        {optionContent}
      </Hint>
    );
  }

  return optionContent;
};
