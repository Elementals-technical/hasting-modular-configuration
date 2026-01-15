import { useEffect, useState } from "react";

import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";

import { Rotate360Icon } from "@/shared/assets/images/svg/Rotate360Icon";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon";
import { HelpPopup } from "@/shared/ui/Popups/ui/HelpPopup/HelpPopup";

import { onFirstOrbitRotation } from "@/utils/playcanvasRotation";

import s from "./Player.module.scss";

export function Player() {
  const [isOpening, setIsOpening] = useState(false);

  const ready = usePlayCanvasReady();
  const [showRotateHint, setShowRotateHint] = useState(() => !sessionStorage.getItem("rotateHintSeen"));

  useEffect(() => {
    if (!ready) return;

    const cleanup = onFirstOrbitRotation(() => setShowRotateHint(false), { sessionKey: "rotateHintSeen" });

    return () => cleanup?.();
  }, [ready]);

  const handleOpenPopup = () => {
    setIsOpening(true);
  };

  return (
    <div className={s.player}>
      <PlayCanvasIntegration />

      {showRotateHint && (
        <div className={s.rotateBlock}>
          <Rotate360Icon />
        </div>
      )}

      <BottomCanvasButtons />

      <div className={s.hintIcon}>
        <div
          className={s.hintIconInner}
          onClick={() => {
            if (isOpening) {
              setIsOpening(false);
            } else {
              handleOpenPopup();
            }
          }}
        >
          <HintIcon fill="#fff" />
          <div>Help</div>
        </div>
        <HelpPopup isOpening={isOpening} setIsOpening={setIsOpening} />
      </div>
    </div>
  );
}
