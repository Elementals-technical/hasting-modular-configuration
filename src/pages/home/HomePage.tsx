import { Outlet, useLocation } from "react-router-dom";

import { ConfiguratorSidebar, Player, SideNavigation } from "@/widgets";

import { HeaderBanner, HeaderMain } from "@/shared";

import s from "./HomePage.module.scss";

export const HomePage = () => {
  const { pathname } = useLocation();
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  return (
    <div className={s.homePageWrap}>
      <HeaderMain />
      <HeaderBanner />

      <div className={s.content}>
        <div className={s.navWrap}>
          <SideNavigation flow={flow} />
        </div>

        <Player />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>
      </div>
    </div>
  );
};
