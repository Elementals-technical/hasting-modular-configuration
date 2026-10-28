import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";

/** How the UI calls the drawers; the scene's `Bot` reads "Bottom" on screen. */
export const DRAWER_LABELS: Readonly<Record<DrawerName, string>> = { Top: "Top", Bot: "Bottom" };
