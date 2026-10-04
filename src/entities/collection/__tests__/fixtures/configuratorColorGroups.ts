import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

const colorGroup = (id: number, proxyName: string, names: string[]): ConfiguratorAvailableOption => ({
  id,
  proxyName,
  proxyType: "material",
  enabled: true,
  metadata: {},
  options: [
    {
      id: id * 10,
      name: "HPL",
      resource: null,
      paramString: null,
      playcanvasString: null,
      variants: names.map((name, index) => ({
        id: id * 100 + index,
        name,
        image: null,
        enabled: true,
        description: "",
        metadata: { sku: "HPL", value: name, label: name, metadata: { Material: "HPL", Color: name, Look: "Matte" } },
      })),
    },
  ],
});

const groups = [
  colorGroup(1, "Cabinet Color", ["Old Cabinet Color", "New Cabinet Color"]),
  colorGroup(2, "Handle Groove Color", ["Old Cabinet Color", "New Cabinet Color"]),
];

export const configuratorColorGroups: ConfiguratorGroupCatalog = {
  groups,
  groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
};
