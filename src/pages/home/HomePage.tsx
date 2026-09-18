import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { useCollectionNavigation } from "@/features/collectionCustomization";

import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";
import { SwatchOrder } from "@/features/swatchOrder";
import { RestoreFailurePopup } from "@/features/configurationRestore";
import { useAvailabilityResets } from "@/features/configurationCommands";
import { reset } from "@/entities/product/model/store/slice";
import {
  captureOrbitCameraState,
  restoreOrbitCameraState,
  type OrbitCameraState,
} from "@/utils/functions/playcanvas/orbitCamera";
import {
  getActiveQuotePreviewCaptureCount,
  QUOTE_PREVIEW_CAMERA_RESTORED_EVENT,
} from "@/features/quotePrint/lib/captureQuotePreviewImage";
import {
  clearPersistedHostUrl,
  persistHostUrlFromSearch,
  readHostUrlFromSearch,
} from "@/features/saveConfiguration";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import s from "./HomePage.module.scss";

const shouldOpenInitialBuildInfo = () => !sessionStorage.getItem("howToBuildSeen");

export const HomePage = () => {
  const [shouldShowInitialBuildInfo, setShouldShowInitialBuildInfo] = useState(shouldOpenInitialBuildInfo);
  const [isCanvasFullMode, setIsCanvasFullMode] = useState(false);

  const { pathname, search } = useLocation();
  const navigation = useCollectionNavigation();
  const flow = navigation?.flowId ?? "prebuilt";
  const isPresetPicker = navigation?.currentStep?.kind === "preset-picker";
  const isSummary = navigation?.isSummary ?? false;

  const dispatch = useAppDispatch();
  const isOpenSidebar = useAppSelector(getIsOpenSidebar);
  useAvailabilityResets();

  // restore default preset when navigate from custom route.
  const prevFlowRef = useRef(flow);
  const summaryEntryCameraStateRef = useRef<OrbitCameraState | null>(null);
  const summaryExitRestoreCleanupRef = useRef<(() => void) | null>(null);
  const wasSummaryRef = useRef(isSummary);
  const hostUrlInitializedRef = useRef(false);

  useLayoutEffect(() => {
    summaryExitRestoreCleanupRef.current?.();
    summaryExitRestoreCleanupRef.current = null;

    const prevFlow = prevFlowRef.current;
    const wasSummary = wasSummaryRef.current;

    if (!wasSummary && isSummary) {
      summaryEntryCameraStateRef.current = captureOrbitCameraState();
    }

    if (wasSummary && !isSummary) {
      const cameraState = summaryEntryCameraStateRef.current;

      if (cameraState) {
        const restoreAfterLayout = () => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              restoreOrbitCameraState(cameraState);
            });
          });
        };

        restoreAfterLayout();

        if (getActiveQuotePreviewCaptureCount() > 0) {
          const handleQuoteCameraRestored = () => {
            restoreAfterLayout();
            summaryExitRestoreCleanupRef.current = null;
          };

          window.addEventListener(QUOTE_PREVIEW_CAMERA_RESTORED_EVENT, handleQuoteCameraRestored, { once: true });
          summaryExitRestoreCleanupRef.current = () => {
            window.removeEventListener(QUOTE_PREVIEW_CAMERA_RESTORED_EVENT, handleQuoteCameraRestored);
          };
        }
      }

      summaryEntryCameraStateRef.current = null;
    }

    if (prevFlow === "custom" && flow === "prebuilt" && isPresetPicker) {
      sessionStorage.setItem("prebuiltModelInitialized", "0");
      dispatch(reset());
    }

    prevFlowRef.current = flow;
    wasSummaryRef.current = isSummary;
  }, [dispatch, flow, isPresetPicker, isSummary, pathname]);

  useEffect(
    () => () => {
      summaryExitRestoreCleanupRef.current?.();
    },
    [],
  );

  useEffect(() => {
    setIsCanvasFullMode(false);
  }, [pathname]);

  useEffect(() => {
    if (readHostUrlFromSearch(search)) {
      persistHostUrlFromSearch(search);
    } else if (!hostUrlInitializedRef.current) {
      clearPersistedHostUrl();
    }

    hostUrlInitializedRef.current = true;
  }, [search]);

  const handleClose = () => {
    sessionStorage.setItem("howToBuildSeen", "1");
    setShouldShowInitialBuildInfo(false);
  };

  const shouldOpenInitialInteractiveTutorial = shouldShowInitialBuildInfo && flow !== "custom";

  return (
    <div className={s.homePageWrap}>
      <div className={`${s.content} ${isSummary ? s.summaryLayout : ""} ${isCanvasFullMode ? s.canvasFullMode : ""}`}>
        <div className={`${s.navWrap} ${isOpenSidebar && s.opened}`}>
          <SideNavigation flow={flow} />
        </div>

        <Player
          isCanvasFullMode={isCanvasFullMode}
          onCanvasFullModeChange={setIsCanvasFullMode}
          initialInteractiveTutorialOpen={shouldOpenInitialInteractiveTutorial}
          onInteractiveTutorialClose={shouldOpenInitialInteractiveTutorial ? handleClose : undefined}
        />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>
      </div>

      <SwatchOrder />
      <RestoreFailurePopup />
    </div>
  );
};
