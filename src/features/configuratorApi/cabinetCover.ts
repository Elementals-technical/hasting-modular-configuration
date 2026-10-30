import type { CabinetCoverColorState, CabinetCoverSegment } from "./types";

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
    const { xMinM, xMaxM, zMinM, zMaxM, cabinetIds, materialId } = entry.segment;
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
        materialId: typeof materialId === "string" && materialId.trim() ? materialId.trim() : null,
      },
    ];
  });
};

/** Reads the published materials rather than preset settings, which may not match the visible slabs. */
export const parseCabinetCoverColorState = (state: unknown): CabinetCoverColorState | null => {
  if (!isRecord(state) || typeof state.compositionId !== "string") return null;
  const service = isRecord(state.service) ? state.service : null;
  if (!service || (service.compositionId && service.compositionId !== state.compositionId)) return null;
  const entries = Array.isArray(service.entries) ? service.entries : [];
  const segments = parseCabinetCoverSegments(state).flatMap((segment) => {
    const entry = entries.find((candidate) => isRecord(candidate) && candidate.productId === segment.productId);
    const source = isRecord(entry) && isRecord(entry.segment) ? entry.segment : null;
    return source &&
      typeof source.materialId === "string" &&
      source.materialId.trim() &&
      finite(source.thicknessM) &&
      source.thicknessM > 0
      ? [{ ...segment, materialId: source.materialId, thicknessM: source.thicknessM }]
      : [];
  });
  const requested = isRecord(state.settings) ? state.settings.materialId : null;
  return {
    compositionId: state.compositionId,
    segments,
    requestedMaterialId: typeof requested === "string" && requested.trim() ? requested.trim() : null,
  };
};
