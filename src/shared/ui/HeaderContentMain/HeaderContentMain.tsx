import { Link } from "react-router-dom";
import s from "./HeaderContentMain.module.scss";
import MainLogo from "../../assets/images/svg/MainLogo";
import { Search } from "../../assets/images/svg/Search";
import { Wishlist } from "../../assets/images/svg/Wishlist";
import { ArrowRight } from "../../assets/images/svg/ArrowRight";
import { LocationIcon } from "../../assets/images/svg/LocationIcon";
import { PhoneIcon } from "../../assets/images/svg/PhoneIcon";
import { CustomerIcon } from "../../assets/images/svg/CustomerIcon";
import { HEADER_MAIN_MENU } from "../../constants";
import { ArrowDown } from "../../assets/images/svg/ArrowDown";

export const HeaderContentMain: React.FC = () => {
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
                <li>
                  <Link to={""}>
                    <span>
                      <LocationIcon />
                    </span>
                    Visit Our NYC Showroom
                  </Link>
                </li>
                <li>
                  <Link to={""}>
                    <span>
                      <PhoneIcon />
                    </span>
                    800-351-0038
                  </Link>
                </li>
                <li>
                  <Link to={""}>
                    <span>
                      <CustomerIcon />
                    </span>
                    Customer Support
                  </Link>
                </li>
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
