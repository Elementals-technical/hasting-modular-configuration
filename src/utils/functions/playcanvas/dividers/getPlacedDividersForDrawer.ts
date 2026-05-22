import { getConfig } from "../getConfig";
import { collectPlacedDividersForDrawer, type RuntimePlacedDivider } from "./parsePlacedDividersConfig";
import type { DrawerType } from "./wrapShowTopView";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function getPlacedDividersForDrawer(
  cabinetId: string,
  drawerType: DrawerType,
): Promise<RuntimePlacedDivider[] | null> {
  const config: unknown = await getConfig(cabinetId);
  if (!isRecord(config)) return null;

  const configKey = drawerType === "Bot" ? "BotDrawerDividers" : "TopDrawerDividers";
  const drawerConfig = config[configKey];
  if (!isRecord(drawerConfig)) return null;

  const zones = drawerConfig.zones;
  if (!isRecord(zones)) return null;

  return collectPlacedDividersForDrawer(cabinetId, drawerType, zones);
}
