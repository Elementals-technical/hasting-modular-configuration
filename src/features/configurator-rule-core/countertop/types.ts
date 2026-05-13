export type CountertopMatrixRule = {
  material: string;
  topThicknesses: string[];
  depths: number[];
  depthsByStyle: Record<string, number[]>;
  basinStyle: string;
  minSbCm: number | null;
  minVesselCm: number | null;
  maxIntegratedCm: number | null;
  maxVesselCm: number | null;
  maxUndermountCm: number | null;
  faucetHoles: string[];
  depthOnlyCm: number[];
  allowedFinishes: string[];
  allowMultiCabinet: boolean | null;
  sidePanelsAction: string | null;
  integratedAllowedSizesOnly: number[];
};
