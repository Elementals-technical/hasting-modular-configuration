import { NavLink } from "react-router-dom";

import { toggle } from "@/features/sidebar/model/store/slice";

import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import s from "./SideNavigation.module.scss";

type SideNavigationProps = {
  flow?: "prebuilt" | "custom";
};

export const SideNavigation = ({ flow = "prebuilt" }: SideNavigationProps) => {
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const dispatch = useAppDispatch();

  return (
    <nav className={s.sideNav} aria-label="Configurator steps">
      <div
        className={s.closeSidebar}
        onClick={() => {
          dispatch(toggle());
        }}
      >
        <ArrowLeft width="25" height="25" fill="#333" />
      </div>

      <ul className={s.navList}>
        {steps.map((step) => (
          <li key={step.id}>
            <NavLink to={step.path} className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ""}`.trim()}>
              {step.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SideNavigation;
