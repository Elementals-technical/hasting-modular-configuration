import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from "react";
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

import { BaseButton } from "@/shared";
import { ArrowInteractive } from "@/shared/assets/images/svg/ArrowInteractive";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS } from "../model/steps";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS,
  type InteractiveConfiguratorTutorialStep,
} from "../model/types";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  getInteractiveConfiguratorTutorialTargetSelector,
} from "../model/targets";
import { getPlayCanvasPlusButtonViewportRect } from "../lib/getPlayCanvasPlusButtonViewportRect";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS,
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

const JOYRIDE_Z_INDEX = 240;
const JOYRIDE_TOOLTIP_WIDTH = 420;
const JOYRIDE_ARROW_WIDTH = 48;
const JOYRIDE_ARROW_HEIGHT = 52;
const JOYRIDE_SPOTLIGHT_RADIUS = 4;
const JOYRIDE_SPOTLIGHT_PADDING = 0;
const STEP_PREPARATION_DELAY_MS = 250;

const CUSTOM_CABINET_TYPE_SELECTION_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customCabinetStyle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

const CUSTOM_CABINET_STYLE_SELECTION_STEP_IDS: ReadonlySet<string> = new Set([
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

const mapTutorialStepToJoyrideStep = (step: InteractiveConfiguratorTutorialStep): JoyrideStep => ({
  id: step.id,
  target: getInteractiveConfiguratorTutorialTargetSelector(step.target),
  placement: step.placement,
  title: step.title,
  content: step.description,
  spotlightPadding: step.spotlightPadding,
  data: {
    primaryLabel: step.primaryLabel,
    secondaryLabel: step.secondaryLabel,
    secondaryAction: step.secondaryAction,
    progressLabel: step.progressLabel,
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
>;

const isStepButtonLabelData = (
  value: unknown,
): value is StepButtonLabelData => {
  if (!value || typeof value !== "object") return false;

  const data = value as Record<string, unknown>;

  return (
    (data.primaryLabel === undefined || typeof data.primaryLabel === "string") &&
    (data.secondaryLabel === undefined || typeof data.secondaryLabel === "string") &&
    (data.secondaryAction === undefined || data.secondaryAction === "back" || data.secondaryAction === "skip") &&
    (data.progressLabel === undefined || typeof data.progressLabel === "string")
  );
};

const getStepData = (step: TooltipRenderProps["step"]) => {
  const data: unknown = step.data;

  return {
    primaryLabel: isStepButtonLabelData(data) ? (data.primaryLabel ?? "Next") : "Next",
    secondaryLabel: isStepButtonLabelData(data) ? data.secondaryLabel : undefined,
    secondaryAction: isStepButtonLabelData(data) ? data.secondaryAction : undefined,
    progressLabel: isStepButtonLabelData(data) ? data.progressLabel : undefined,
  };
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
            <li key={item}>{item}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }

    if (line) {
      renderedContent.push(<p key={`line-${index}`}>{line}</p>);
    }
  });

  if (listItems.length) {
    renderedContent.push(
      <ul key="list-last" className={s.list}>
        {listItems.map((item) => (
          <li key={item}>{item}</li>
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
  const { primaryLabel, progressLabel, secondaryAction, secondaryLabel } = getStepData(step);
  const secondaryProps = secondaryAction === "back" ? backProps : skipProps;

  return (
    <div className={s.tooltip} {...tooltipProps}>
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

      <div className={s.content}>
        {renderDescription(step.content)}
      </div>

      <div className={s.footer}>
        <div className={s.progress}>{progressLabel}</div>

        {secondaryLabel ? (
          <BaseButton
            variant="ghost"
            fullWidth={true}
            aria-label={secondaryProps["aria-label"]}
            onClick={(event) => secondaryProps.onClick(event)}
          >
            {secondaryLabel}
          </BaseButton>
        ) : (
          <span />
        )}

        <BaseButton
          fullWidth={true}
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

export const InteractiveConfiguratorTutorial = ({ isOpen, onClose }: InteractiveConfiguratorTutorialProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [playCanvasTargetRect, setPlayCanvasTargetRect] = useState<ViewportRect | null>(null);

  const closeTutorial = useCallback(() => {
    setPlayCanvasTargetRect(null);
    setVisibleButtons(false);
    dispatch(setOpenStyleSidebar(false));
    onClose();
  }, [dispatch, onClose]);

  const prepareTutorialStep = useCallback(
    async (step: InteractiveConfiguratorTutorialStep) => {
      if (step.route && `${location.pathname}${location.search}` !== step.route) {
        navigate(step.route);
      }

      const shouldOpenStyleSidebar =
        step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle ||
        step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet;

      setVisibleButtons(step.id === INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet);
      setPlayCanvasTargetRect(null);

      await waitForStepPreparation();

      if (CUSTOM_CABINET_TYPE_SELECTION_STEP_IDS.has(step.id)) {
        dispatchInteractiveConfiguratorTutorialEvent(
          INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetType,
        );
        await waitForStepPreparation();
      }

      if (CUSTOM_CABINET_STYLE_SELECTION_STEP_IDS.has(step.id)) {
        dispatchInteractiveConfiguratorTutorialEvent(
          INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectDefaultCabinetStyle,
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
    [dispatch, location.pathname, location.search, navigate],
  );

  const joyrideSteps = useMemo(
    () =>
      INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS.map((step) => ({
        ...mapTutorialStepToJoyrideStep(step),
        before: () => prepareTutorialStep(step),
      })),
    [prepareTutorialStep],
  );

  const handleJoyrideEvent = useCallback(
    (event: EventData) => {
      if (isTerminalJoyrideEvent(event)) {
        closeTutorial();
      }
    },
    [closeTutorial],
  );

  return (
    <>
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
