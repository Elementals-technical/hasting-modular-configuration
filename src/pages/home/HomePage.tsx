import { Outlet, useLocation } from "react-router-dom";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";
import { toggle } from "@/features/sidebar/model/store/slice";

import { HeaderBanner, HeaderMain } from "@/shared";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import s from "./HomePage.module.scss";

export const HomePage = () => {
  const { pathname } = useLocation();
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  const dispatch = useAppDispatch();
  const isOpenSidebar = useAppSelector(getIsOpenSidebar);

  return (
    <div className={s.homePageWrap}>
      <HeaderMain />
      <HeaderBanner />

      <div className={s.content}>
        <div className={`${s.navWrap} ${isOpenSidebar && s.opened}`}>
          <SideNavigation flow={flow} />
        </div>

        <div className={s.currentStep}>
          <div>Step :</div>
          <div className={s.title} onClick={() => dispatch(toggle())}>
            Model
            <ArrowRight />
          </div>
        </div>

        <Player />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>
      </div>
    </div>
  );
};
