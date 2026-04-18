const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

type ConfiguratorVisibilityVariant = {
  enabled: boolean;
  name: string;
  metadata?: Record<string, unknown>;
};

export const isVisibleConfiguratorVariant = ({
  proxyName,
  variant,
}: {
  proxyName: string;
  variant: ConfiguratorVisibilityVariant;
}): boolean => {
  if (!variant.enabled) return false;
  if (proxyName !== "Cabinet Color") return true;
  if (variant.name.trim() !== "Grigio Bromo") return true;

  const meta = (variant.metadata ?? {}) as Record<string, unknown>;
  const nested =
    typeof meta.metadata === "object" && meta.metadata
      ? (meta.metadata as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const label = pickString(meta.label, meta.Label, nested.label, nested.Label);
  const value = pickString(meta.value, nested.value);

  // Hide the malformed Cabinet Color row that arrives without the FE code.
  return Boolean(label || value);
};
