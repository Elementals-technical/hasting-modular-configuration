/** What a configurator group holds, whatever the configurator calls it. */
export type ConfiguratorGroupKind = "cabinet" | "groove" | "countertop" | "vessel" | "towelBar";

/**
 * Configurator 4 names its groups "Cabinet Color", "Vessels" and so on; the per-collection material
 * configurators (11-14) and Mako's 9 call the same groups "Select Cabinet Color", "Select Vessel
 * Color". Duplex's 13 holds both panels in "Select Cabinet Colors".
 */
const KIND_BY_GROUP_NAME = new Map<string, ConfiguratorGroupKind>([
  ["Cabinet Color", "cabinet"],
  ["Select Cabinet Color", "cabinet"],
  ["Select Cabinet Colors", "cabinet"],
  ["Handle Groove Color", "groove"],
  ["Select Handle Groove Color", "groove"],
  ["Countertop Color", "countertop"],
  ["Select Countertop Color", "countertop"],
  ["Vessels", "vessel"],
  ["Select Vessel Color", "vessel"],
  ["Towel Bar Color", "towelBar"],
  ["Select Towel Bar Color", "towelBar"],
]);

/** Configurator 4's name of each kind: the product element the swatch order knows a group by. */
const PRODUCT_ELEMENT_BY_KIND: Record<ConfiguratorGroupKind, string> = {
  cabinet: "Cabinet Color",
  groove: "Handle Groove Color",
  countertop: "Countertop Color",
  vessel: "Vessels",
  towelBar: "Towel Bar Color",
};

export const getConfiguratorGroupKind = (proxyName: string): ConfiguratorGroupKind | null =>
  KIND_BY_GROUP_NAME.get(proxyName) ?? null;

/**
 * The product element a group stands for: configurator 4's name for a known kind, otherwise the
 * group's own name without "Select " ("Select Leg Cap Color" -> "Leg Cap Color").
 */
export const getConfiguratorProductElement = (proxyName: string): string => {
  const kind = getConfiguratorGroupKind(proxyName);
  return kind ? PRODUCT_ELEMENT_BY_KIND[kind] : proxyName.replace(/^Select /, "");
};
