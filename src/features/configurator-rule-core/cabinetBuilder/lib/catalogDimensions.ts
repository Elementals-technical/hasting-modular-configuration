import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

const isPositiveFiniteNumber = (value: number): boolean => Number.isFinite(value) && value > 0;

export const getUniqueCatalogWidths = (catalog: ConfiguratorCatalog): number[] =>
  Array.from(new Set(catalog.typeCabinetRules.flatMap((rule) => rule.widths).filter(isPositiveFiniteNumber))).sort(
    (left, right) => left - right,
  );
