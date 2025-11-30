import { Link } from "react-router-dom";

import MainLogo from "@/shared/assets/images/svg/MainLogo";
import { Search } from "@/shared/assets/images/svg/Search";
import { Wishlist } from "@/shared/assets/images/svg/Wishlist";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { HEADER_MAIN_MENU, HEADER_TOP_RIGHT_MENU } from "@/shared/constants";
import { ArrowDown } from "@/shared/assets/images/svg/ArrowDown";

import s from "./HeaderMain.module.scss";

export const HeaderMain = () => {
  return (
    <>
      <div className={s.mainHeaderContent}>
        <div className={s.headerTop}>
          <div className={s.container}>
            <div className={s.headerTop_left}>
              Our Customers Love Us:
              <Link to={"#"} className={s.headerTop_left__link}>
                View Our Case Studies
                <ArrowRight />
              </Link>
            </div>
            <div className={s.headerTop_right}>
              <ul className={s.headerTop_right__menu}>
                {HEADER_TOP_RIGHT_MENU.map((i, idx) => {
                  return (
                    <li key={idx}>
                      <Link to={i.to}>
                        <span>{i.icon}</span>
                        {i.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        <div className={s.headerBottom}>
          <div className={s.container}>
            <div className={s.headerBottom_left}>
              <MainLogo />
            </div>
            <div className={s.headerBottom_menu}>
              <ul>
                {HEADER_MAIN_MENU.map((item) => (
                  <li key={item.title}>
                    <Link to={item.to}>
                      {item.title}
                      <span>
                        <ArrowDown />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className={s.headerBottom_right}>
                <Search />
                <Wishlist />
                <button className={s.btn}>Connect With Us</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.mainHeaderContent__mobile}>
        <div className={s.headerBottom}>
          <div className={s.container}>
            <div className={s.headerBottom_left}>
              <MainLogo height="36" width="150" />
            </div>
            <div className={s.headerBottom_menu}>
              <div className={s.headerBottom_right}>
                <button className={s.btn}>Connect With Us</button>

                <Search width="30" height="30" />

                <div className={s.burgerMenu} aria-label="Toggle menu">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
