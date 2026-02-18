import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";

import { Rotate360Icon } from "@/shared/assets/images/svg/Rotate360Icon";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon";
import { HelpPopup } from "@/shared/ui/Popups/ui/HelpPopup/HelpPopup";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { SharePopup } from "@/shared/ui/Popups/ui/sharePopup/SharePopup";

import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSaveConfigurationMutation } from "@/entities";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCabinetColor,
  getCountertopStyle,
  getDividersOption,
  getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getHandleGrooveColor,
  getLedOption,
  getSidePanelsOption,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";

import { onFirstOrbitRotation } from "@/utils/playcanvasRotation";

import s from "./Player.module.scss";
import { QuoteIcon } from "@/shared/assets/images/svg/QuoteIcon";

export function Player() {
  const location = useLocation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isSummaryPage = pathname.includes("/summary");

  const [isShareOpening, setIsShareOpening] = useState(false);
  const [shareValue, setShareValue] = useState("");

  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const sinkType = useAppSelector(getSinkType);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const ledOption = useAppSelector(getLedOption);
  const dividersOption = useAppSelector(getDividersOption);
  const dividersStyle = useAppSelector(getDividersStyle);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

  const [saveConfiguration] = useSaveConfigurationMutation();

  const handleSaveConfiguration = async () => {
    const ids = getOrderedProductIds();

    if (!ids.length) {
      console.warn("[Configurations] No products to save");
      setShareValue("No products to save");
      setIsShareOpening(true);
      return;
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const metadata = {
      path: pathname,
      savedAt: new Date().toISOString(),
      orderedProductIds: ids,
      uiState: {
        CabinetColor: cabinetColor,
        HandleGrooveColor: handleGrooveColor,
        sinkType,
        CountertopColor: countertopColor,
        Thickness: countertopThickness,
        DrawerPanelFluting: drawerPanelFluting,
        GrainDirection: grainDirection,
        CountertopStyle: countertopStyle,
        SidePanels: sidePanelsOption,
        LedOption: ledOption,
        DividersOption: dividersOption,
        DividersStyle: dividersStyle,
        TowelBarOption: towelBarOption,
        TowelBarColor: towelBarColor,
        FaucetHolesAmount: faucetHolesAmount,
        FaucetHolesSpacing: faucetHolesSpacing,
      },
    };

    try {
      const result = await saveConfiguration({ configuration, metadata }).unwrap();
      const configId = result?.id;

      if (configId !== undefined && configId !== null) {
        const url = `${window.location.origin}/custom/cabinet-builder?configId=${encodeURIComponent(String(configId))}`;
        setShareValue(url);
        setIsShareOpening(true);
      }
    } catch (error) {
      console.error("[Configurations] Save failed", error);
    }
  };

  const handleGenerateQuote = () => {
    const content = document.getElementById("summary-content");
    if (!content) return;

    const clone = content.cloneNode(true) as HTMLElement;
    clone.id = "summary-print-clone";
    document.body.appendChild(clone);

    const restore = () => {
      clone.remove();
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
  };

  const handleCopyShareValue = async () => {
    if (!shareValue) return;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(shareValue);
      }
    } catch (err) {
      console.error("[Share] Failed to copy via clipboard API", err);
    }
  };

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

      {isSummaryPage && (
        <div className={s.generateBtn} onClick={handleGenerateQuote}>
          <span>Generate Quote</span>
          <QuoteIcon />
        </div>
      )}

      {!isSummaryPage ? (
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
      ) : (
        <div className={s.shareIcon} onClick={handleSaveConfiguration}>
          <span>Share</span>
          <ShareIcon stroke="#fff" />
        </div>
      )}

      <SharePopup
        isOpening={isShareOpening}
        setIsOpening={setIsShareOpening}
        shareValue={shareValue}
        onCopy={handleCopyShareValue}
      />
    </div>
  );
}
