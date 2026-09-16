import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

import { close, toggle } from "@/features/sidebar/model/store/slice";
import { useCollectionNavigation, withPreservedCollectionId } from "@/features/collectionCustomization";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight.tsx";
import { closeDrawerInteraction } from "@/utils/functions/playcanvas/dividers";

import { getIsOpenSidebar } from "@/features/sidebar/model/store/selectors";

import s from "./SideNavigation.module.scss";

type SideNavigationProps = {
  flow?: "prebuilt" | "custom";
};

export const SideNavigation = ({ flow = "prebuilt" }: SideNavigationProps) => {
  const navigation = useCollectionNavigation(flow);
  const steps = navigation?.steps ?? [];
  const location = useLocation();

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
        <ArrowRight width="25" height="25" stroke={"#333"} />
        <div className={s.mode}>{flow === "custom" ? "Custom" : "Pre-Built"}</div>
      </div>

      <ul className={s.navList}>
        {steps.map((step) => (
          <li key={step.stepId}>
            <NavLink
              to={withPreservedCollectionId(step.path, location.search)}
              className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ""}`.trim()}
              onClick={() => {
                closeDrawerInteraction();
                dispatch(close());
              }}
            >
              {step.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SideNavigation;
