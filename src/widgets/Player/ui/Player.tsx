import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";
import { StepNavigationBar } from "@/features/StepNavigationBar/StepNavigationBar";
import { openSwatchSidebar } from "@/features/swatchSidebar/model/store/slice";

import { Rotate360Icon } from "@/shared/assets/images/svg/Rotate360Icon";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { HintIcon } from "@/shared/assets/images/svg/HintIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { SharePopup } from "@/shared/ui/Popups/ui/sharePopup/SharePopup";
import { HowToStart } from "@/shared/ui/Popups/ui/HowToStartPopup/HowToStartPopup";
import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import quickEditorStep from "@/shared/assets/images/png/popup/Step_3.png";
import { HelpCenterPopup, type HelpCenterNode } from "@/widgets/helpCenter";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
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
  getGrainDirection,
  getHandleGrooveColor,
  getLedOption,
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { getActiveStep } from "@/features/sidebar/model/store/selectors";
import { getIsSwatchesEnabledInSummary, getSelectedSwatches } from "@/features/swatchSidebar/model/store/selectors";

import { onFirstOrbitRotation } from "@/utils/playcanvasRotation";

import s from "./Player.module.scss";
import { QuoteIcon } from "@/shared/assets/images/svg/QuoteIcon";

export function Player() {
  const location = useLocation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const isSummaryPage = pathname.includes("/summary");

  const [isShareOpening, setIsShareOpening] = useState(false);
  const [shareValue, setShareValue] = useState("");
  const [howToStep, setHowToStep] = useState<number | null>(null);
  const [isCustomInstructionOpen, setIsCustomInstructionOpen] = useState(false);

  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const sinkType = useAppSelector(getSinkType);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const ledOption = useAppSelector(getLedOption);
  const dividersOption = useAppSelector(getDividersOption);
  const dividersStyle = useAppSelector(getDividersStyle);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const isSwatchesEnabledInSummary = useAppSelector(getIsSwatchesEnabledInSummary);
  const selectedSwatches = useAppSelector(getSelectedSwatches);

  const [saveConfiguration] = useSaveConfigurationMutation();
  const activeStep = useAppSelector(getActiveStep);

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
        SidePanelLeft: sidePanelLeft,
        SidePanelRight: sidePanelRight,
        LedOption: ledOption,
        DividersOption: dividersOption,
        DividersStyle: dividersStyle,
        TowelBarOption: towelBarOption,
        TowelBarColor: towelBarColor,
        FaucetHolesAmount: faucetHolesAmount,
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

  const handleGenerateQuote = async () => {
    const content = document.getElementById("quote-print-root") ?? document.getElementById("summary-content");
    if (!content) return;

    const clone = content.cloneNode(true) as HTMLElement;
    clone.id = "summary-print-clone";

    if (!isSwatchesEnabledInSummary || selectedSwatches.length === 0) {
      clone.querySelector('[data-summary-section="swatches"]')?.remove();
    }

    document.body.appendChild(clone);

    const restore = () => {
      clone.remove();
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);

    const images = Array.from(clone.querySelectorAll("img"));
    if (images.length) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) {
                resolve();
                return;
              }

              const done = () => {
                img.removeEventListener("load", done);
                img.removeEventListener("error", done);
                resolve();
              };

              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            }),
        ),
      );
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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
  const helpPath = (searchParams.get("helpPath") ?? "")
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);

  const setHelpPath = (nextPath: string[]) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextPath.length) {
      nextParams.set("helpPath", nextPath.join("."));
    } else {
      nextParams.delete("helpPath");
    }

    const search = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true, state: location.state },
    );
  };

  const handleOpenPopup = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("help", "1");
    nextParams.delete("helpPath");

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
    nextParams.delete("helpPath");
    const search = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  };

  const closePopupWithoutBack = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("help");
    nextParams.delete("step");
    nextParams.delete("helpPath");
    const search = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  };

  const helpNodes: HelpCenterNode[] = [
    {
      id: "configurator-how-tos",
      label: "Configurator How-Tos",
      children: [
        {
          id: "prebuilt-mode-tutorial",
          label: "Pre-Built Mode tutorial",
          action: () => {
            setHowToStep(1);
            closePopupWithoutBack();
          },
        },
        {
          id: "custom-mode-tutorial",
          label: "Custom Mode tutorial",
          action: () => {
            setIsCustomInstructionOpen(true);
            closePopupWithoutBack();
          },
        },
        {
          id: "in-scene-quick-editor",
          label: "In-scene quick editor",
          content: {
            title: "In-Scene Quick Editor",
            intro: "Use the in-scene editor to make fast-paced edits:",
            bullets: [
              "Point and click any element to make edits",
              "Resize, reposition, clone and duplicate cabinets",
              "Modify countertop color, style, thickness, etc.",
            ],
            image: quickEditorStep,
          },
        },
      ],
    },
    {
      id: "product-questions-design-assistance",
      label: "Product Questions & Design Assistance",
      children: [
        { id: "chat-with-product-expert", label: "Chat with a Product Expert", href: "#" },
        {
          id: "meet-virtually",
          label: "Meet Virtually",
          href: "https://meetings.hubspot.com/jennifer727/sdr-meeting-scheduler-round-robin",
          external: true,
        },
        { id: "hubspot-phone", label: "+1 (631) 859-7174", href: "tel:+16318597174" },
      ],
    },
    {
      id: "order-free-swatches",
      label: "Order Free Swatches",
      action: () => {
        dispatch(openSwatchSidebar());
        handleClosePopup();
      },
    },
    {
      id: "how-to-buy",
      label: "How To Buy",
      content: {
        title: "",
        subtitle:
          "Custom bathroom furniture leaves no room for shortcuts - we sweat the small stuff, so you don't have to.",
        steps: [
          {
            number: "01",
            title: "Configure & Submit Your Design",
            text: "Share your design configuration through the form. Our team receives your design and reaches out within 24 hours to get the ball rolling.",
          },
          {
            number: "02",
            title: "Your Solution Specialist",
            text: "We pair you with a dedicated specialist - your go-to to finalize your design. They support you and your team, making it a breeze. Here's how it works:",
            bullets: [
              {
                title: "Sample Box Curation.",
                text: "Confidence in your colorways is a must. We curate your box for review.",
              },
              {
                title: "Vetting the details.",
                text: "We ensure all the details are spot on for you.",
              },
              {
                title: "Product Expertise.",
                text: "We answer any and all your solution questions.",
              },
            ],
          },
          {
            number: "03",
            title: "Choose Your Purchase Path",
            text: "After we finalize your design, you choose your purchase path - through our NYC Showroom or Dealer network",
          },
        ],
      },
    },
    {
      id: "visit-our-showroom",
      label: "Visit our Showroom",
      children: [
        {
          id: "schedule-a-visit",
          label: "Schedule a Visit",
          href: "https://meetings.hubspot.com/boni-osmani/showroom-meeting-scheduler-round-robin",
          external: true,
        },
        {
          id: "take-a-virtual-tour",
          label: "Take a Virtual Tour",
          href: "https://www.hastingsbathcollection.com/visit-our-nyc-showroom#anchor-3d-tour",
          external: true,
        },
        {
          id: "showroom-address",
          label: "Showroom Address",
          content: {
            icon: "map-pin",
            subtitle: "A&D Building",
            intro: "150 East 58th St, 10th Floor, NY, NY, 10155",
          },
        },
      ],
    },
    {
      id: "general-product-information",
      label: "General Product Information",
      content: {
        title: "Product Details",
        bullets: [
          "Special Order: All solutions are built-to-order",
          "Lead Time: 10-12 weeks",
          "Country of Origin: Italy",
          "Warranty: 36 months",
          "All materials are Carb2 compliant",
        ],
        sections: [
          {
            title: "Custom Made, Not Pre-Made",
            text: "At Hastings, each design is crafted and created for you. Our flexible, modular approach is built for adaptability which makes tailoring solutions that fit your look, space and lifestyle, seamless.",
          },
          {
            title: "Uncompromising Italian Design",
            text: "Exclusively made and designed in Italy, this chic series features sophisticated detailing, European ingenuity and Italian modern living.",
          },
          {
            title: "Built for Longevity",
            text: "Meticulous workmanship, modern engineering and premium materials are at the core of each design. All of which lay the groundwork for lasting durability.",
          },
        ],
      },
    },
  ];

  return (
    <div className={s.player}>
      <div className={s.mobileStepNavigation}>
        <StepNavigationBar title={activeStep} flow={pathname.includes("/custom") ? "custom" : "prebuilt"} />
      </div>

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
          <HelpCenterPopup
            isOpening={isOpening}
            onClose={handleClosePopup}
            nodes={helpNodes}
            path={helpPath}
            onPathChange={setHelpPath}
          />
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

      {howToStep !== null && <HowToStart handleClose={() => setHowToStep(null)} initialStep={howToStep} />}
      {isCustomInstructionOpen && <InstructionPopup handleClose={() => setIsCustomInstructionOpen(false)} />}
    </div>
  );
}
