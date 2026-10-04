type ConfiguratorVisibilityVariant = {
  enabled: boolean;
  name: string;
  metadata?: Record<string, unknown>;
};

const readSku = (variant: ConfiguratorVisibilityVariant): unknown => {
  const meta = variant.metadata ?? {};
  const nested = typeof meta.metadata === "object" && meta.metadata ? (meta.metadata as Record<string, unknown>) : {};

  return meta.sku ?? nested.sku;
};

/**
 * Whether a configurator variant is offered at all.
 *
 * A variant without a SKU can be neither priced nor ordered, so it is not shown. Configurator 4
 * has no such variant. Configurator 9 carries the palettes of other collections beside Mako's own
 * and marks every one of them `enabled`, so the SKU is the only thing that tells them apart.
 */
export const isVisibleConfiguratorVariant = (variant: ConfiguratorVisibilityVariant): boolean => {
  if (!variant.enabled) return false;

  const sku = readSku(variant);
  return typeof sku === "string" && sku.trim().length > 0;
};
