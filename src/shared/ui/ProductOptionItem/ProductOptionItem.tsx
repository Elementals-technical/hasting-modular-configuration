import color_img from "../../assets/images/png/img_png.png";
import none_img from "../../assets/images/png/none_img.png";
import { Hint } from "../Hint/Hint";

import { HintOptionIcon } from "@/shared/assets/images/svg/HintOptionIcon";
import { ExpandIcon } from "@/shared/assets/images/svg/ExpandIcon";
import type { ProductOptionMetadata } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import s from "./ProductOptionItem.module.scss";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { useReasonText, type MessageParams } from "@/shared/lib/reasonText";

/** Shown when an option is unavailable and its rule named no reason. */
const UNAVAILABLE_OPTION_REASON_CODE = "ui.optionUnavailable";

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
  /** Text a caller resolved itself; used while its rule has no reason code. */
  disabledReason?: string;
  /** Stable reason code; the interface resolves it (`shared/lib/reasonText`). */
  disabledReasonCode?: string;
  disabledReasonParams?: MessageParams;
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
  disabledReasonCode,
  disabledReasonParams,
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
  const reasonText = useReasonText();
  const available = isAvailable ?? true; // undefined as available
  const unavailableText = reasonText({
    code: disabledReasonCode ?? UNAVAILABLE_OPTION_REASON_CODE,
    params: disabledReasonParams,
    text: disabledReason,
  });
  const productName = name ?? title;
  const hasImage = !!metadata?.image;
  const hasHexColor = !!metadata?.hex;
  const hasVisual = hasImage || hasHexColor;
  const isLightHex = hasHexColor && /^#?(f{3}|f{6})$/i.test(metadata!.hex!.trim());
  const needsLightBorder = isLightHex || metadata?.lightBorder === true;
  const imageSrc = hasImage ? buildImageSrc(metadata?.image) : title !== "None" ? color_img : none_img;
  const isCabinetTypeVariant = variant === "cabinetType";
  const isAccessoryVariant = variant === "accessory";
  const isSinkBaseCabinetType = isCabinetTypeVariant && metadata?.hasSink === true;
  const isSideCabinetType = isCabinetTypeVariant && metadata?.hasSink === false && metadata?.isOpen === false;

  const optionContent = (
    <div
      className={`${s.productOption} ${isActive ? s.activeItem : ""} ${isMaterial ? s.materialOption : ""} ${isCabinetTypeVariant ? s.cabinetTypeItem : ""} ${isAccessoryVariant ? s.accessoryItem : ""} ${isSinkBaseCabinetType ? s.sinkBaseCabinetTypeItem : ""} ${isSideCabinetType ? s.sideCabinetTypeItem : ""} ${!available ? s.disabledOption : ""}`}
    >
      <button
        type="button"
        className={s.selectButton}
        aria-label={title}
        aria-pressed={isActive}
        aria-disabled={!available || undefined}
        onClick={() => {
          if (!available) return;
          onClick?.(productName, config, metadata);
          setActive?.(id);
        }}
      >
        <span className={s.imageContainer}>
          <span
            className={`${s.image} ${hasVisual ? s.withVisual : ""} ${!available ? s.imageDisabled : ""} ${needsLightBorder ? s.lightBorder : ""}`}
          >
            {hasImage ? (
              <img src={imageSrc} alt="" />
            ) : hasHexColor ? (
              <span className={s.colorSwatch} style={{ backgroundColor: metadata?.hex }} />
            ) : (
              <img src={imageSrc} alt="" />
            )}
          </span>
        </span>

        {available ? (
          <span className={`${s.title} ${s.titleHint}`}>
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
          </span>
        ) : (
          <span className={s.disabledTitleRow}>
            <span className={`${s.title} ${s.titleDisabled}`}>{title}</span>
            {disabledBadgeLabel && <span className={s.disabledBadge}>{disabledBadgeLabel}</span>}
          </span>
        )}

        <span className={s.desc}>{desc}</span>
      </button>
      {onPreview && (
        <button
          type="button"
          className={s.expandBtn}
          aria-label={`Preview ${title}`}
          onClick={() => onPreview(title, metadata)}
        >
          <ExpandIcon />
        </button>
      )}
      {!available && disabledActionLabel && onDisabledAction && (
        <button
          type="button"
          className={s.disabledAction}
          onClick={() => {
            void onDisabledAction();
          }}
        >
          {disabledActionLabel}
        </button>
      )}
    </div>
  );

  if (!available) {
    return (
      <Hint className={s.optionHint} content={unavailableText}>
        {optionContent}
      </Hint>
    );
  }

  return optionContent;
};
