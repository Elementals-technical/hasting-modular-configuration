import { HeaderMain } from "../../shared";
import HeaderBanner from "../../shared/ui/HeaderBanner/HeaderBanner";
import Player from "../../widgets/Player/ui/Player.tsx";
import { ConfiguratorSidebar } from "../../widgets/ConfiguratorSidebar/ui/ConfiguratorSidebar.tsx";

import s from "./HomePage.module.scss";

export const HomePage = () => {
  return (
    <div className={s.homePageWrap}>
      <HeaderMain />
      <HeaderBanner />

      <div className={s.content}>
        <Player />
        <ConfiguratorSidebar />
      </div>
    </div>
  );
};
