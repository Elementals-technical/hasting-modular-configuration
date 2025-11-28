import { HeaderContentMain } from "../../shared";
import HeaderBanner from "../../shared/ui/HeaderBanner/HeaderBanner";
import s from "./HomePage.module.scss";

export const HomePage: React.FC = () => {
  return (
    <div className={s.homePageWrap}>
      <HeaderContentMain />

      <HeaderBanner />

      <div className={s.content}>content</div>
    </div>
  );
};
