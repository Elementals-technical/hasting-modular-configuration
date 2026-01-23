import type { Configurator, ConfiguratorAvailableOption, ConfiguratorView } from "../api/types";

export const filterConfiguratorByView = (configurator: Configurator, view: ConfiguratorView): Configurator => {
  if (view === "full") {
    return configurator;
  }

  const availableOptions = configurator.availableOptions
    .filter((option) => option.enabled)
    .map((option) => ({
      ...option,
      options: option.options.map((entry) => ({
        ...entry,
        variants: entry.variants.filter((variant) => variant.enabled),
      })),
    }));

  return {
    ...configurator,
    availableOptions,
  };
};

export const groupAvailableOptionsByProxyType = (
  availableOptions: ConfiguratorAvailableOption[],
): Record<string, ConfiguratorAvailableOption[]> =>
  availableOptions.reduce<Record<string, ConfiguratorAvailableOption[]>>((acc, option) => {
    if (!acc[option.proxyType]) {
      acc[option.proxyType] = [];
    }

    acc[option.proxyType].push(option);
    return acc;
  }, {});
