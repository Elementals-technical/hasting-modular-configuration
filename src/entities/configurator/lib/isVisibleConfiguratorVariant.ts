type ConfiguratorVisibilityVariant = {
  enabled: boolean;
  name: string;
  metadata?: Record<string, unknown>;
};

export const isVisibleConfiguratorVariant = ({
  variant,
}: {
  proxyName: string;
  variant: ConfiguratorVisibilityVariant;
}): boolean => {
  if (!variant.enabled) return false;
  return true;
};
