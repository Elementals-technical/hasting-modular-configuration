import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTIONS,
  Joyride,
  STATUS,
  type EventData,
  type Options,
  type Step as JoyrideStep,
  type Styles,
  type TooltipRenderProps,
} from "react-joyride";
import { useLocation, useNavigate } from "react-router-dom";

import { BaseButton, ROUTES } from "@/shared";
import { ArrowInteractive } from "@/shared/assets/images/svg/ArrowInteractive";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS } from "../model/steps";
import { INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS, type InteractiveConfiguratorTutorialStep } from "../model/types";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  getInteractiveConfiguratorTutorialTargetSelector,
} from "../model/targets";
import { getPlayCanvasPlusButtonViewportRect } from "../lib/getPlayCanvasPlusButtonViewportRect";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS,
  dispatchInteractiveConfiguratorTutorialActiveStepChange,
  dispatchInteractiveConfiguratorTutorialEvent,
} from "../lib/tutorialBridge";

import s from "./InteractiveConfiguratorTutorial.module.scss";

type InteractiveConfiguratorTutorialProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ViewportRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const JOYRIDE_Z_INDEX = 2000;
const JOYRIDE_TOOLTIP_WIDTH = 420;
const JOYRIDE_ARROW_WIDTH = 48;
const JOYRIDE_ARROW_HEIGHT = 52;
const JOYRIDE_SPOTLIGHT_RADIUS = 4;
const JOYRIDE_SPOTLIGHT_PADDING = 0;
const STEP_PREPARATION_DELAY_MS = 250;
const STEP_CONTENT_SCROLL_CONTAINER_SELECTOR = '[data-scroll-container="step-content"]';
const DEFAULT_START_ROUTE = `${ROUTES.PREBUILT}/model`;
const COMPACT_TUTORIAL_MEDIA_QUERY = "(max-width: 1024px)";

const CUSTOM_CABINET_TYPE_SELECTION_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetStyle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

const CUSTOM_CABINET_STYLE_SELECTION_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

const CUSTOM_SCENE_CABINET_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

const JOYRIDE_OPTIONS = {
  arrowBase: JOYRIDE_ARROW_HEIGHT,
  arrowSize: JOYRIDE_ARROW_WIDTH,
  closeButtonAction: "skip",
  dismissKeyAction: false,
  overlayClickAction: false,
  overlayColor: "rgba(40, 40, 40, 0.25)",
  primaryColor: "#ac5331",
  scrollDuration: 250,
  scrollOffset: 90,
  spotlightPadding: JOYRIDE_SPOTLIGHT_PADDING,
  spotlightRadius: JOYRIDE_SPOTLIGHT_RADIUS,
  targetWaitTimeout: 1500,
  width: JOYRIDE_TOOLTIP_WIDTH,
  zIndex: JOYRIDE_Z_INDEX,
} satisfies Partial<Options>;

const COMPACT_STEP_PLACEMENTS: Partial<
  Record<InteractiveConfiguratorTutorialStep["id"], JoyrideStep["placement"]>
> = {
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.gettingStarted]: "bottom",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.prebuiltMode]: "top",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.prebuiltDetails]: "top",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customMode]: "bottom",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetType]: "bottom",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetStyle]: "bottom",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle]: "left",
  [INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet]: "top",
};

const getIsCompactTutorialLayout = () => window.matchMedia(COMPACT_TUTORIAL_MEDIA_QUERY).matches;

const mapTutorialStepToJoyrideStep = (
  step: InteractiveConfiguratorTutorialStep,
  isCompactLayout: boolean,
): JoyrideStep => ({
  id: step.id,
  target: getInteractiveConfiguratorTutorialTargetSelector(step.target),
  placement: isCompactLayout ? (COMPACT_STEP_PLACEMENTS[step.id] ?? step.placement) : step.placement,
  title: step.title,
  content: step.description,
  blockTargetInteraction: !step.allowTargetScroll,
  skipScroll: step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.prebuiltDetails,
  spotlightPadding: step.spotlightPadding,
  styles: isCompactLayout
    ? {
        floater: {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        },
      }
    : step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet
      ? {
          floater: {
            top: 105,
          },
        }
      : undefined,
  data: {
    primaryLabel: step.primaryLabel,
    secondaryLabel: step.secondaryLabel,
    secondaryAction: step.secondaryAction,
    progressLabel: step.progressLabel,
    isCompactLayout,
  },
  skipBeacon: true,
});

const JOYRIDE_STYLES = {
  spotlight: {
    fill: "transparent",
    stroke: "#ac5331",
    strokeWidth: 1,
  },
} satisfies Partial<Styles>;

const waitForStepPreparation = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, STEP_PREPARATION_DELAY_MS);
  });

const getFallbackTargetRect = (step: InteractiveConfiguratorTutorialStep): ViewportRect | null => {
  const fallbackTarget =
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet
      ? INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customSizingHandle
      : step.target;
  const target = document.querySelector(getInteractiveConfiguratorTutorialTargetSelector(fallbackTarget));

  if (!(target instanceof HTMLElement)) return null;

  const rect = target.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const getPrebuiltModelsGridViewportRect = (): ViewportRect | null => {
  const target = document.querySelector(
    getInteractiveConfiguratorTutorialTargetSelector(INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.prebuiltModelsGrid),
  );

  if (!(target instanceof HTMLElement)) return null;

  const scrollContainer = target.closest(STEP_CONTENT_SCROLL_CONTAINER_SELECTOR);
  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer instanceof HTMLElement ? scrollContainer.getBoundingClientRect() : targetRect;
  const top = Math.max(targetRect.top, containerRect.top);
  const bottom = Math.max(top, containerRect.bottom);

  return {
    top,
    left: targetRect.left,
    width: targetRect.width,
    height: bottom - top,
  };
};

const getVisibleTargetViewportRect = (targetName: InteractiveConfiguratorTutorialStep["target"]): ViewportRect | null => {
  const target = document.querySelector(getInteractiveConfiguratorTutorialTargetSelector(targetName));

  if (!(target instanceof HTMLElement)) return null;

  target.scrollIntoView({ block: "nearest", inline: "nearest" });

  const scrollContainer = target.closest(STEP_CONTENT_SCROLL_CONTAINER_SELECTOR);
  const targetRect = target.getBoundingClientRect();
  const containerRect =
    scrollContainer instanceof HTMLElement
      ? scrollContainer.getBoundingClientRect()
      : {
          top: 0,
          left: 0,
          right: document.documentElement.clientWidth,
          bottom: document.documentElement.clientHeight,
        };
  const top = Math.max(targetRect.top, containerRect.top, 0);
  const left = Math.max(targetRect.left, containerRect.left, 0);
  const right = Math.min(targetRect.right, containerRect.right, document.documentElement.clientWidth);
  const bottom = Math.min(targetRect.bottom, containerRect.bottom, document.documentElement.clientHeight);

  if (right <= left || bottom <= top) return null;

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
};

const getProxyTargetStyle = ({ height, left, top, width }: ViewportRect): CSSProperties => ({
  position: "fixed",
  top,
  left,
  width,
  height,
  pointerEvents: "none",
});

type StepButtonLabelData = Partial<
  Pick<InteractiveConfiguratorTutorialStep, "primaryLabel" | "secondaryLabel" | "secondaryAction" | "progressLabel">
> & {
  isCompactLayout?: boolean;
};

const isStepButtonLabelData = (value: unknown): value is StepButtonLabelData => {
  if (!value || typeof value !== "object") return false;

  const data = value as Record<string, unknown>;

  return (
    (data.primaryLabel === undefined || typeof data.primaryLabel === "string") &&
    (data.secondaryLabel === undefined || typeof data.secondaryLabel === "string") &&
    (data.secondaryAction === undefined || data.secondaryAction === "back" || data.secondaryAction === "skip") &&
    (data.progressLabel === undefined || typeof data.progressLabel === "string") &&
    (data.isCompactLayout === undefined || typeof data.isCompactLayout === "boolean")
  );
};

const getStepData = (step: TooltipRenderProps["step"]) => {
  const data: unknown = step.data;

  return {
    primaryLabel: isStepButtonLabelData(data) ? (data.primaryLabel ?? "Next") : "Next",
    secondaryLabel: isStepButtonLabelData(data) ? data.secondaryLabel : undefined,
    secondaryAction: isStepButtonLabelData(data) ? data.secondaryAction : undefined,
    progressLabel: isStepButtonLabelData(data) ? data.progressLabel : undefined,
    isCompactLayout: isStepButtonLabelData(data) ? data.isCompactLayout === true : false,
  };
};

const renderListItem = (item: string) => {
  const delimiterIndex = item.indexOf(":");

  if (delimiterIndex === -1) return item;

  return (
    <>
      <strong>{item.slice(0, delimiterIndex + 1)}</strong>
      {item.slice(delimiterIndex + 1)}
    </>
  );
};

const getDescriptionLineClassName = (line: string) => {
  if (line === "Cabinet Type") return s.emphasizedLine;
  if (line === "Cabinet Style") return s.emphasizedLine;
  if (line === "Sizing & Handle") return s.emphasizedLine;
  if (line === "Place Your Cabinet") return s.emphasizedLine;
  if (line.startsWith("Pro Tip:")) return s.proTip;

  return undefined;
};

const renderDescription = (content: TooltipRenderProps["step"]["content"]) => {
  if (typeof content !== "string") return content;

  const renderedContent: ReactNode[] = [];
  let listItems: string[] = [];

  content.split("\n").forEach((line, index) => {
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }

    if (listItems.length) {
      renderedContent.push(
        <ul key={`list-${index}`} className={s.list}>
          {listItems.map((item) => (
            <li key={item}>{renderListItem(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }

    if (line) {
      renderedContent.push(
        <p key={`line-${index}`} className={getDescriptionLineClassName(line)}>
          {line}
        </p>,
      );
    }
  });

  if (listItems.length) {
    renderedContent.push(
      <ul key="list-last" className={s.list}>
        {listItems.map((item) => (
          <li key={item}>{renderListItem(item)}</li>
        ))}
      </ul>,
    );
  }

  return renderedContent;
};

const TutorialTooltip = ({
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) => {
  const { isCompactLayout, primaryLabel, progressLabel, secondaryAction, secondaryLabel } = getStepData(step);
  const secondaryProps = secondaryAction === "back" ? backProps : skipProps;
  const tooltipClassName = [
    s.tooltip,
    isCompactLayout ? s.compactTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.gettingStarted ? s.gettingStartedTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetType ? s.customCabinetTypeTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetStyle ? s.customCabinetStyleTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle ? s.customSizingHandleTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.prebuiltDetails ? s.prebuiltDetailsTooltip : "",
    step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet ? s.customPlaceCabinetTooltip : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div {...tooltipProps} className={tooltipClassName}>
      <div className={s.header}>
        <div className={s.title}>{step.title}</div>
        <button
          type="button"
          className={s.closeButton}
          aria-label={closeProps["aria-label"]}
          onClick={(event) => closeProps.onClick(event)}
        >
          <CloseBtnIcon />
        </button>
      </div>

      <div className={s.content}>{renderDescription(step.content)}</div>

      <div className={s.footer}>
        <div className={s.progress}>{progressLabel}</div>

        {secondaryLabel ? (
          <BaseButton
            variant="ghost"
            className={s.secondaryButton}
            aria-label={secondaryProps["aria-label"]}
            onClick={(event) => secondaryProps.onClick(event)}
          >
            {secondaryLabel}
          </BaseButton>
        ) : (
          <span />
        )}

        <BaseButton
          className={s.primaryButton}
          aria-label={primaryProps["aria-label"]}
          onClick={(event) => primaryProps.onClick(event)}
        >
          {primaryLabel}
        </BaseButton>
      </div>
    </div>
  );
};

const isTerminalJoyrideEvent = ({ action, status }: EventData): boolean =>
  action === ACTIONS.CLOSE || status === STATUS.FINISHED || status === STATUS.SKIPPED;

const getTutorialTargetElements = (step: InteractiveConfiguratorTutorialStep): HTMLElement[] => {
  const selector = getInteractiveConfiguratorTutorialTargetSelector(step.target);

  return Array.from(document.querySelectorAll<HTMLElement>(selector));
};

const shouldBlockTargetEvent = (
  step: InteractiveConfiguratorTutorialStep,
  eventTarget: EventTarget | null,
): boolean => {
  if (!(eventTarget instanceof Node)) return false;

  return getTutorialTargetElements(step).some((target) => target.contains(eventTarget));
};

export const InteractiveConfiguratorTutorial = ({ isOpen, onClose }: InteractiveConfiguratorTutorialProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [isCompactLayout, setIsCompactLayout] = useState(getIsCompactTutorialLayout);
  const [createYourOwnTargetRect, setCreateYourOwnTargetRect] = useState<ViewportRect | null>(null);
  const [modeSwitcherTargetRect, setModeSwitcherTargetRect] = useState<ViewportRect | null>(null);
  const [playCanvasTargetRect, setPlayCanvasTargetRect] = useState<ViewportRect | null>(null);
  const [prebuiltModelsGridTargetRect, setPrebuiltModelsGridTargetRect] = useState<ViewportRect | null>(null);
  const [activeStepId, setActiveStepId] = useState<InteractiveConfiguratorTutorialStep["id"] | null>(null);

  const activeStep = useMemo<InteractiveConfiguratorTutorialStep | undefined>(
    () => INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS.find((step) => step.id === activeStepId),
    [activeStepId],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_TUTORIAL_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsCompactLayout(event.matches);

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const closeTutorial = useCallback(() => {
    dispatchInteractiveConfiguratorTutorialEvent(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.cancelPendingActions);
    dispatchInteractiveConfiguratorTutorialActiveStepChange(null);
    setActiveStepId(null);
    setCreateYourOwnTargetRect(null);
    setModeSwitcherTargetRect(null);
    setPlayCanvasTargetRect(null);
    setPrebuiltModelsGridTargetRect(null);
    setVisibleButtons(false);
    dispatch(setOpenStyleSidebar(false));
    navigate(DEFAULT_START_ROUTE, { replace: true });
    onClose();
  }, [dispatch, navigate, onClose]);

  const prepareTutorialStep = useCallback(
    async (step: InteractiveConfiguratorTutorialStep) => {
      dispatchInteractiveConfiguratorTutorialActiveStepChange(step.id);
      setActiveStepId(step.id);

      if (step.route && `${location.pathname}${location.search}` !== step.route) {
        navigate(step.route);
      }

      const shouldOpenStyleSidebar =
        step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle ||
        step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet;

      setVisibleButtons(step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet);
      setCreateYourOwnTargetRect(null);
      setModeSwitcherTargetRect(null);
      setPlayCanvasTargetRect(null);
      setPrebuiltModelsGridTargetRect(null);

      await waitForStepPreparation();

      if (isCompactLayout && step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.gettingStarted) {
        setModeSwitcherTargetRect(
          getVisibleTargetViewportRect(INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.modelModeSwitcher),
        );
        await waitForStepPreparation();
        return;
      }

      if (isCompactLayout && step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customMode) {
        setCreateYourOwnTargetRect(getFallbackTargetRect(step));
        await waitForStepPreparation();
        return;
      }

      if (step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.prebuiltMode) {
        setPrebuiltModelsGridTargetRect(
          isCompactLayout
            ? getFallbackTargetRect(step)
            : getPrebuiltModelsGridViewportRect() ?? getFallbackTargetRect(step),
        );
        await waitForStepPreparation();
        return;
      }

      if (CUSTOM_CABINET_TYPE_SELECTION_STEP_IDS.has(step.id)) {
        dispatchInteractiveConfiguratorTutorialEvent(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetType);
        await waitForStepPreparation();
      }

      if (CUSTOM_CABINET_STYLE_SELECTION_STEP_IDS.has(step.id)) {
        dispatchInteractiveConfiguratorTutorialEvent(
          INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetStyle,
        );
        await waitForStepPreparation();
      }

      if (CUSTOM_SCENE_CABINET_STEP_IDS.has(step.id)) {
        dispatchInteractiveConfiguratorTutorialEvent(
          INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.ensureSelectedCabinetOnScene,
        );
        await waitForStepPreparation();
      }

      dispatch(setOpenStyleSidebar(shouldOpenStyleSidebar));

      if (shouldOpenStyleSidebar) {
        await waitForStepPreparation();
      }

      if (step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet) {
        setPlayCanvasTargetRect(getPlayCanvasPlusButtonViewportRect() ?? getFallbackTargetRect(step));
        await waitForStepPreparation();
        return;
      }
    },
    [dispatch, isCompactLayout, location.pathname, location.search, navigate],
  );

  const joyrideSteps = useMemo(
    () =>
      INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS.map((step) => ({
        ...mapTutorialStepToJoyrideStep(step, isCompactLayout),
        before: () => prepareTutorialStep(step),
      })),
    [isCompactLayout, prepareTutorialStep],
  );

  const handleJoyrideEvent = useCallback(
    (event: EventData) => {
      if (isTerminalJoyrideEvent(event)) {
        closeTutorial();
      }
    },
    [closeTutorial],
  );

  useEffect(() => {
    if (isOpen) return;

    dispatchInteractiveConfiguratorTutorialActiveStepChange(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeStep?.allowTargetScroll) return;

    const blockTargetClick = (event: MouseEvent) => {
      if (!shouldBlockTargetEvent(activeStep, event.target)) return;

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", blockTargetClick, true);
    document.addEventListener("dblclick", blockTargetClick, true);
    document.addEventListener("auxclick", blockTargetClick, true);

    return () => {
      document.removeEventListener("click", blockTargetClick, true);
      document.removeEventListener("dblclick", blockTargetClick, true);
      document.removeEventListener("auxclick", blockTargetClick, true);
    };
  }, [activeStep, isOpen]);

  return (
    <>
      {createYourOwnTargetRect && (
        <div
          className={s.proxyTarget}
          data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.createYourOwnMode}
          style={getProxyTargetStyle(createYourOwnTargetRect)}
        />
      )}

      {modeSwitcherTargetRect && (
        <div
          className={s.proxyTarget}
          data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.modelModeSwitcher}
          style={getProxyTargetStyle(modeSwitcherTargetRect)}
        />
      )}

      {prebuiltModelsGridTargetRect && (
        <div
          className={s.proxyTarget}
          data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.prebuiltModelsGrid}
          style={getProxyTargetStyle(prebuiltModelsGridTargetRect)}
        />
      )}

      {playCanvasTargetRect && (
        <div
          className={s.proxyTarget}
          data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customPlaceCabinet}
          style={getProxyTargetStyle(playCanvasTargetRect)}
        />
      )}

      <Joyride
        continuous={true}
        options={JOYRIDE_OPTIONS}
        run={isOpen}
        steps={joyrideSteps}
        styles={JOYRIDE_STYLES}
        arrowComponent={ArrowInteractive}
        tooltipComponent={TutorialTooltip}
        onEvent={handleJoyrideEvent}
      />
    </>
  );
};
