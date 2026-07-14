import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";
import { SwatchOrder } from "@/features/swatchOrder";
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
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  const dispatch = useAppDispatch();
  const isOpenSidebar = useAppSelector(getIsOpenSidebar);

  // restore default preset when navigate from custom route.
  const prevPathRef = useRef(pathname);
  const summaryEntryCameraStateRef = useRef<OrbitCameraState | null>(null);
  const summaryExitRestoreCleanupRef = useRef<(() => void) | null>(null);
  const wasSummaryRef = useRef(pathname.endsWith("/summary"));
  const hostUrlInitializedRef = useRef(false);

  useLayoutEffect(() => {
    summaryExitRestoreCleanupRef.current?.();
    summaryExitRestoreCleanupRef.current = null;

    const prevPath = prevPathRef.current;
    const wasSummary = wasSummaryRef.current;
    const isSummary = pathname.endsWith("/summary");

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

    if (prevPath.startsWith("/custom") && pathname.startsWith("/prebuilt/model")) {
      sessionStorage.setItem("prebuiltModelInitialized", "0");
      dispatch(reset());
    }

    prevPathRef.current = pathname;
    wasSummaryRef.current = isSummary;
  }, [dispatch, pathname]);

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

  const isSummary = pathname.endsWith("/summary");
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
    </div>
  );
};
