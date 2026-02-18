import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import type { ProductOptionMetadata } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { PopupCenterContent } from "../PopupCenterContent/PopupCenterContent";

import s from "./MaterialPreviewModal.module.scss";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;
  return imagePath;
};

interface MaterialPreviewModalI {
  isOpening: boolean;
  onClose: () => void;
  title: string;
  metadata?: ProductOptionMetadata;
}

export const MaterialPreviewModal: React.FC<MaterialPreviewModalI> = ({ isOpening, onClose, title, metadata }) => {
  const imageSrc = buildImageSrc(metadata?.image);

  return (
    <PopupCenterContent isOpening={isOpening} onClose={onClose}>
      <div className={s.modal}>
        <div className={s.header}>
          <div className={s.title}>{title}</div>
          <button className={s.closeBtn} onClick={onClose}>
            <CloseBtnIcon />
          </button>
        </div>

        <div className={s.preview}>
          {imageSrc ? (
            <img src={imageSrc} alt={title} className={s.image} />
          ) : metadata?.hex ? (
            <div className={s.colorSwatch} style={{ backgroundColor: metadata.hex }} />
          ) : null}
        </div>
      </div>
    </PopupCenterContent>
  );
};
