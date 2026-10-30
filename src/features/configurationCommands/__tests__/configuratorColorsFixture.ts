import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type {
  ConfiguratorAvailableOption,
  ConfiguratorOption,
  ConfiguratorVariant,
} from "@/entities/configurator/api/types";

/**
 * A small "Cabinet Color" and "Handle Groove Color" configurator section.
 *
 * The recorded configurator 4 fixture holds only 3D colours, so the SKU mapping, a colour
 * whose material comes from its option name and a finish code need colours of their own.
 *
 * Every offered variant carries a SKU, as configurator 4 does. "Cepp Stone TKP" carries one the
 * profile does not map, so its material still has to come from the option name.
 */

const variant = (id: number, name: string, sku: string, enabled = true): ConfiguratorVariant => ({
  id,
  name,
  image: null,
  enabled,
  description: "",
  metadata: { sku, value: name, label: name },
});

const option = (id: number, name: string, variants: ConfiguratorVariant[]): ConfiguratorOption => ({
  id,
  name,
  resource: null,
  paramString: null,
  playcanvasString: null,
  variants,
});

const colorGroup = (id: number, proxyName: string): ConfiguratorAvailableOption => ({
  id,
  proxyName,
  proxyType: "material",
  enabled: true,
  metadata: {},
  options: [
    option(id * 10 + 1, "Essenze", [variant(id * 100 + 1, "Rovere Naturale", "ESS")]),
    option(id * 10 + 2, "Lacquered Matte", [variant(id * 100 + 2, "Bianco LACM", "LACM")]),
    option(id * 10 + 3, "HPL", [
      variant(id * 100 + 3, "Cepp Stone TKP", "TKH"),
      variant(id * 100 + 4, "Retired Oak", "ESS", false),
    ]),
  ],
});

const groups = [colorGroup(1, "Cabinet Color"), colorGroup(2, "Handle Groove Color")];

export const configuratorColors: ConfiguratorGroupCatalog = {
  groups,
  groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
};
