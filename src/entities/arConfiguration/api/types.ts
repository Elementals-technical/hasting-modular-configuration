export type ArConfigurationPayload = {
  configuration: Record<string, unknown>;
  glb?: File;
  usdz?: File;
};

export type ArConfigurationRecord = {
  id?: string | number;
  configuration?: Record<string, unknown>;
  glbUrl?: string;
  usdzUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};
