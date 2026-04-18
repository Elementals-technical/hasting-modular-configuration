import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

export const parseHeightMapping = (raw: string): Record<string, number> =>
  Object.fromEntries(
    raw.split("|").flatMap((entry) => {
      const colonIdx = entry.indexOf(":");
      if (colonIdx === -1) return [];
      const key = entry.slice(0, colonIdx).trim();
      const num = Number(entry.slice(colonIdx + 1).trim());
      return key && Number.isFinite(num) ? [[key, num]] : [];
    }),
  );

export const resolveForcedHeightForHandle = (args: {
  catalog: ConfiguratorCatalog;
  cabinetType: string | null;
  drawers: string | null;
  handle: string | null;
}): number | null => {
  const { catalog, cabinetType, drawers, handle } = args;
  if (!cabinetType || !drawers || !handle) return null;

  const rule = catalog.typeCabinetRules.find((r) => r.code === cabinetType);
  if (!rule) return null;

  const raw =
    handle === "handle_pto"
      ? rule.handlePtoForcedHeightCm
      : handle === "handle_urban_topcut"
        ? rule.handleUrbanTopcutForcedHeightCm
        : handle === "handle_urban_botcut"
          ? rule.handleUrbanBotcutForcedHeightCm
          : null;

  if (!raw) return null;

  return parseHeightMapping(raw)[drawers] ?? null;
};
