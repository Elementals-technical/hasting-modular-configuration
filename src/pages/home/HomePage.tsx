import { Outlet, useLocation } from "react-router-dom";

import Player from "@/widgets/Player/ui/Player.tsx";
import { ConfiguratorSidebar } from "@/widgets/ConfiguratorSidebar/ui/ConfiguratorSidebar.tsx";

import { HeaderMain } from "@/shared";
import HeaderBanner from "@/shared/ui/HeaderBanner/HeaderBanner";

import s from "./HomePage.module.scss";

export const HomePage = () => {
  const { pathname } = useLocation();
  const flow: "prebuilt" | "custom" = pathname.includes("/custom") ? "custom" : "prebuilt";

  return (
    <div className={s.homePageWrap}>
      <HeaderMain />
      <HeaderBanner />

      <div className={s.content}>
        <Player />

        <ConfiguratorSidebar flow={flow}>
          <Outlet />
        </ConfiguratorSidebar>
      </div>
    </div>
  );
};
