export type ConfiguratorView = "short" | "full";

export type ConfiguratorVariant = {
  id: number;
  name: string;
  image: string;
  enabled: boolean;
  description: string;
  metadata: Record<string, unknown>;
};

export type ConfiguratorOption = {
  id: number;
  name: string;
  resource: string;
  paramString: string;
  playcanvasString: string;
  variants: ConfiguratorVariant[];
};

export type ConfiguratorAvailableOption = {
  id: number;
  proxyName: string;
  proxyType: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  options: ConfiguratorOption[];
};

export type Configurator = {
  id: number;
  name: string;
  enabled: boolean;
  organizationId: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  availableOptions: ConfiguratorAvailableOption[];
  availableGeometryOptions: ConfiguratorAvailableOption[];
  availableStandardOptions: ConfiguratorAvailableOption[];
};

export type GetConfiguratorArgs = {
  id: string | number;
  view?: ConfiguratorView;
  serialize?: boolean;
};
