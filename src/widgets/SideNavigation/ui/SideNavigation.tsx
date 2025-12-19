import { NavLink } from "react-router-dom";
import { useEffect, useRef } from "react";

import { close, toggle } from "@/features/sidebar/model/store/slice";

import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";

import s from "./SideNavigation.module.scss";

type SideNavigationProps = {
  flow?: "prebuilt" | "custom";
};

export const SideNavigation = ({ flow = "prebuilt" }: SideNavigationProps) => {
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const dispatch = useAppDispatch();
  const isSidebarOpen = useAppSelector(getIsOpenSidebar);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      if (sidebarRef.current.contains(event.target as Node)) return;
      dispatch(close());
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, isSidebarOpen]);

  return (
    <nav ref={sidebarRef} className={s.sideNav} aria-label="Configurator steps">
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
