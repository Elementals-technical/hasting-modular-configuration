import type { PropsWithChildren } from "react";

import { StepNavigationBar } from "@/shared/ui/StepNavigationBar /StepNavigationBar";

import s from "./ConfiguratorSidebar.module.scss";

type ConfiguratorSidebarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const ConfiguratorSidebar = ({ flow = "prebuilt", children }: ConfiguratorSidebarProps) => {
  return (
    <div className={s.configSidebar} data-flow={flow}>
      <StepNavigationBar />

      <div className={s.stepContent}>{children}</div>
    </div>
  );
};
