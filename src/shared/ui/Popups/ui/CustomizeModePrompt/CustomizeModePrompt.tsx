import { BaseButton } from "@/shared";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { PopupCenterContent } from "../../PopupCenterContent/PopupCenterContent";

import s from "./CustomizeModePrompt.module.scss";

interface CustomizeModePromptProps {
  isOpening: boolean;
  setIsOpening: (isOpening: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export const CustomizeModePrompt: React.FC<CustomizeModePromptProps> = ({
  isOpening,
  setIsOpening,
  onConfirm,
  title = "Looking to alter the configuration?",
  description = "Switch to Custom Mode to add, resize, reposition, remove cabinets, and more.",
}) => {
  const handleCancel = () => setIsOpening(false);

  const handleConfirm = () => {
    setIsOpening(false);
    onConfirm();
  };

  return (
    <PopupCenterContent onClose={handleCancel} isOpening={isOpening}>
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>{title}</div>
          <div className={s.button} onClick={handleCancel}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          <p>{description}</p>
        </div>

        <div className={s.footer}>
          <div>
            <BaseButton variant="ghost" onClick={handleCancel} fullWidth={true}>
              Cancel
            </BaseButton>
          </div>
          <div>
            <BaseButton onClick={handleConfirm} fullWidth={true}>
              Switch to Custom Mode
              <ArrowTopRight />
            </BaseButton>
          </div>
        </div>
      </div>
    </PopupCenterContent>
  );
};
