import type { CabinetCoverSegment } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * The cover slabs of `ConfiguratorAPI.cabinetCover.getState()`: `service.entries[] = { productId, segment }`,
 * where the segment spans `xMinM..xMaxM` along the row and `zMinM..zMaxM` in depth. An entry the runtime
 * reports without a usable size is left out; a state without entries has no covers.
 */
export const parseCabinetCoverSegments = (state: unknown): CabinetCoverSegment[] => {
  const service = isRecord(state) ? state.service : null;
  const entries = isRecord(service) && Array.isArray(service.entries) ? service.entries : [];

  return entries.flatMap((entry): CabinetCoverSegment[] => {
    if (!isRecord(entry) || typeof entry.productId !== "string" || !isRecord(entry.segment)) return [];
    const { xMinM, xMaxM, zMinM, zMaxM, cabinetIds } = entry.segment;
    if (!finite(xMinM) || !finite(xMaxM) || !finite(zMinM) || !finite(zMaxM)) return [];
    const widthM = xMaxM - xMinM;
    const depthM = zMaxM - zMinM;
    if (widthM <= 0 || depthM <= 0) return [];

    return [
      {
        productId: entry.productId,
        widthM,
        depthM,
        cabinetIds: Array.isArray(cabinetIds) ? cabinetIds.filter((id): id is string => typeof id === "string") : [],
      },
    ];
  });
};
