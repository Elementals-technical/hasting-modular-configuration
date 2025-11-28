import { Link } from "react-router-dom";
import s from "./HeaderContentMain.module.scss";
import MainLogo from "../../assets/images/svg/MainLogo";
import { Search } from "../../assets/images/svg/Search";
import { Wishlist } from "../../assets/images/svg/Wishlist";

export const HeaderContentMain: React.FC = () => {
  return (
    <>
      <div className={s.mainHeaderContent}>
        <div className={s.headerTop}>
          <div className={s.container}>
            <div className="headerTop_left">
              Our Customers Love Us:
              <Link to={"#"}> View Our Case Studies</Link>
            </div>
            <div className={s.headerTop_right}>
              <ul className={s.headerTop_right__menu}>
                <li>
                  <Link to={""}>Visit Our NYC Showroom</Link>
                </li>
                <li>
                  <Link to={""}>800-351-0038</Link>
                </li>
                <li>
                  <Link to={""}>Customer Support</Link>
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
                <li>
                  <Link to={""}>Products</Link>
                </li>
                <li>
                  <Link to={""}>Inspiration</Link>
                </li>
                <li>
                  <Link to={""}>Resources</Link>
                </li>
                <li>
                  <Link to={""}>How to Buy</Link>
                </li>
                <li>
                  <Link to={""}>Company</Link>
                </li>
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
