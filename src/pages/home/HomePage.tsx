import { Outlet, useLocation } from "react-router-dom";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";

import { HeaderBanner, HeaderMain } from "@/shared";

import s from "./HomePage.module.scss";
import { useAppSelector } from "@/shared/hooks/store/redux";

export const HomePage = () => {
  const { pathname } = useLocation();
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  const isOpenSidebar = useAppSelector(getIsOpenSidebar);

  return (
    <div className={s.homePageWrap}>
      <HeaderMain />
      <HeaderBanner />

      <div className={s.content}>
        {isOpenSidebar && (
          <div className={s.navWrap}>
            <SideNavigation flow={flow} />
          </div>
        )}

        <Player />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>
      </div>
    </div>
  );
};
