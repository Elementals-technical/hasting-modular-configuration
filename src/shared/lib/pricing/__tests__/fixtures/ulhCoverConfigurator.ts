import { URBAN_LOW_HEIGHT } from "./collectionPricingScenarios";

// The existing configurator-4 fixture is deliberately tiny. These additional variants were verified
// with GET /configurators/4?view=full&serialize=true on 2026-10-12, and Rox Black TKQ, the HPL cabinet
// colour Urban Low Height starts in, on 2026-10-14 (not price fixtures).
const groups = URBAN_LOW_HEIGHT.configurator.groups.map((group) => {
  if (group.proxyName !== "Cabinet Color") return group;
  const base = group.options[0];
  const variant = base.variants[0];
  return {
    ...group,
    options: [
      ...group.options.map((option, index) =>
        index === 0
          ? {
              ...option,
              variants: [
                ...option.variants,
                {
                  ...variant,
                  id: 90_001,
                  name: "Colortech Bianco 10B",
                  metadata: { value: "Colortech Bianco 10B", sku: "3D", Material: "3D" },
                },
              ],
            }
          : option,
      ),
      {
        ...base,
        id: 90_002,
        name: "Lacquered GL",
        variants: [
          {
            ...variant,
            id: 90_003,
            name: "Blu Pavone A6 GL",
            metadata: { value: "Blu Pavone A6 GL", sku: "LACG", Material: "Lacquered GL" },
          },
        ],
      },
      {
        ...base,
        id: 90_004,
        name: "HPL",
        variants: [
          {
            ...variant,
            id: 90_005,
            name: "Rox Black TKQ",
            metadata: { value: "Rox Black TKQ", sku: "HPL", Material: "HPL" },
          },
        ],
      },
    ],
  };
});

export const ulhCoverConfigurator = {
  groups,
  groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
};
