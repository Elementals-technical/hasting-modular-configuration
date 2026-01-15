export type ConfigurationPayload = {
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type ConfigurationRecord = {
  id?: string | number;
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};
