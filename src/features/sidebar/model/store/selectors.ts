import type { RootState } from "@/app/store";

export const getIsOpenSidebar = (state: RootState) => state.rootStateUI.sidebar.isOpen;
