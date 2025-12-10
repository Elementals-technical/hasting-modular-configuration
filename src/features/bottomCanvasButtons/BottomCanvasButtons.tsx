import { BaseButton } from "@/shared";
import { DimentionsIcon } from "@/shared/assets/images/svg/DimentionsIcon";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { RotateIcon } from "@/shared/assets/images/svg/RotateIcon";

import s from "./BottomCanvasButtons.module.scss";

export const BottomCanvasButtons = () => {
  return (
    <div className={s.bottomCanvasButtons}>
      <BaseButton variant="ghost">
        <DimentionsIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ZoomInIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ZoomOutIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ArIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ShareIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <RotateIcon />
      </BaseButton>
    </div>
  );
};
