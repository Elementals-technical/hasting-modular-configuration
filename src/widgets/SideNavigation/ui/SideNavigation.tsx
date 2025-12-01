import { NavLink } from "react-router-dom";

import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import s from "./SideNavigation.module.scss";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";

type SideNavigationProps = {
  flow?: "prebuilt" | "custom";
};

export const SideNavigation = ({ flow = "prebuilt" }: SideNavigationProps) => {
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  return (
    <nav className={s.sideNav} aria-label="Configurator steps">
      <div className={s.closeSidebar}>
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
