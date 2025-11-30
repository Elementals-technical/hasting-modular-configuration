import { Link } from "react-router-dom";

import hotfire_telephone from "@/shared/assets/images/png/hotfire3.png";
import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";

import s from "./HeaderBanner.module.scss";

const HeaderBanner = () => {
  return (
    <div className={s.headerBannerMain}>
      <Link to={"#"} className={s.headerBannerMain_link}>
        <span>
          <span className={s.headerBannerMain_img}>
            <img src={hotfire_telephone} alt="#" />
          </span>
          <span>
            <span>Designer Hotline</span>
            <span> Contact Us For Expedited Service</span>
          </span>
        </span>
        <span className={s.headerPhone}>+1 631-910-6906</span>
      </Link>

      <div className={s.closeIcon}>
        <CloseIcon />
      </div>
    </div>
  );
};

export default HeaderBanner;
