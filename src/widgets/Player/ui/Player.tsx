import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";

import { Rotate360Icon } from "@/shared/assets/images/svg/Rotate360Icon";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon";
import { HelpPopup } from "@/shared/ui/Popups/ui/HelpPopup/HelpPopup";

import { onFirstOrbitRotation } from "@/utils/playcanvasRotation";

import s from "./Player.module.scss";

export function Player() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const ready = usePlayCanvasReady();
  const [showRotateHint, setShowRotateHint] = useState(() => !sessionStorage.getItem("rotateHintSeen"));

  useEffect(() => {
    if (!ready) return;

    const cleanup = onFirstOrbitRotation(() => setShowRotateHint(false), { sessionKey: "rotateHintSeen" });

    return () => cleanup?.();
  }, [ready]);

  const isOpening = searchParams.get("help") === "1";
  const hasHelpState = Boolean((location.state as { helpModal?: boolean } | null)?.helpModal);

  const handleOpenPopup = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("help", "1");

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { state: { helpModal: true } },
    );
  };

  const handleClosePopup = () => {
    if (hasHelpState) {
      navigate(-1);
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("help");
    nextParams.delete("step");
    const search = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
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
              handleClosePopup();
            } else {
              handleOpenPopup();
            }
          }}
        >
          <HintIcon fill="#fff" />
          <div>Help</div>
        </div>
        <HelpPopup isOpening={isOpening} onClose={handleClosePopup} />
      </div>
    </div>
  );
}
