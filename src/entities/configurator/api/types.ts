export type ConfiguratorView = "short" | "full";

export type ConfiguratorMaterialMetadata = {
  Look?: string;
  Color?: string;
  Material?: string;
  image?: string;
  hex?: string;
  label?: string;
  value?: string;
  Label?: string;
  zoomIconColor?: string;
  [key: string]: unknown;
};

export type ConfiguratorVariantMetadata = {
  sku?: string;
  value?: string;
  label?: string;
  Label?: string;
  metadata?: ConfiguratorMaterialMetadata;
  [key: string]: unknown;
};

export type ConfiguratorVariant = {
  id: number;
  name: string;
  image: string | null;
  enabled: boolean;
  description: string;
  metadata: ConfiguratorVariantMetadata;
};

export type ConfiguratorOption = {
  id: number;
  name: string;
  resource: string | null;
  paramString: string | null;
  playcanvasString: string | null;
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

export type GetConfiguratorQueryArg = GetConfiguratorArgs | string | number;
