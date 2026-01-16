import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { getActiveStep, getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";
import { toggle } from "@/features/sidebar/model/store/slice";
import { reset } from "@/entities/product/model/store/slice";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { HowToStart } from "@/shared/ui/Popups/ui/HowToStartPopup/HowToStartPopup";

import s from "./HomePage.module.scss";

export const HomePage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("howToBuildSeen"));

  const { pathname } = useLocation();
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  const dispatch = useAppDispatch();
  const isOpenSidebar = useAppSelector(getIsOpenSidebar);
  const activeStep = useAppSelector(getActiveStep);

  // restore default preset when navigate from custom route.
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prevPath = prevPathRef.current;

    if (prevPath.startsWith("/custom") && pathname.startsWith("/prebuilt/model")) {
      sessionStorage.setItem("prebuiltModelInitialized", "0");
      dispatch(reset());
    }

    prevPathRef.current = pathname;
  }, [dispatch, pathname]);

  const handleClose = () => {
    sessionStorage.setItem("howToBuildSeen", "1");
    setIsOpenedBuildInfo(false);
  };

  return (
    <div className={s.homePageWrap}>
      <div className={s.content}>
        <div className={`${s.navWrap} ${isOpenSidebar && s.opened}`}>
          <SideNavigation flow={flow} />
        </div>

        <div className={s.currentStep}>
          <div>Step :</div>
          <div className={s.title} onClick={() => dispatch(toggle())}>
            {activeStep}
            <ArrowRight />
          </div>
        </div>

        <Player />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>

        {isOpenedBuildInfo && <HowToStart handleClose={handleClose} />}
      </div>
    </div>
  );
};
