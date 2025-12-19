export type TypeCabinetRuleConfig = {
  id: number;
  code: string;
  widths: number[];
  depths: number[];
  heights: number[];
  drawers: string[];
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

const typeCabinetRules: TypeCabinetRuleConfig[] = [
  {
    id: 101,
    code: "Sink-Base",
    widths: [60, 70, 80, 90, 105, 120],
    depths: [50.5, 46],
    heights: [50, 53, 56],
    drawers: ["1", "2", "1+inner"],
  },
  {
    id: 102,
    code: "Sink-Cabinet",
    widths: [60, 70, 80, 90, 105, 120],
    depths: [50.5, 46],
    heights: [53],
    drawers: ["2"],
  },
  {
    id: 104,
    code: "Side-Cabinet",
    widths: [25, 35, 50, 60, 70, 80, 90, 105, 120],
    depths: [50.5, 46],
    heights: [50, 53, 56],
    drawers: ["1", "2", "1+inner"],
  },
  {
    id: 103,
    code: "Open-Shelf",
    widths: [25, 35, 50, 60, 70],
    depths: [50.5, 46],
    heights: [50, 53, 56],
    drawers: [],
  },
];

const uniqueNumbers = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);

/**
  flatten берёт массив массивов чисел (width/depth/height по типам) и сводит в один плоский массив, чтобы построить общий “универсум” значений и потом сделать uniqueNumbers(). Это нужно, чтобы знать полный список допустимых размеров для всех типов без ручного перечисления.
 */
const flatten = (items: number[][]) => items.reduce<number[]>((acc, item) => acc.concat(item), []);

export const typeCabinetDimensionUniverse = {
  width: uniqueNumbers(flatten(typeCabinetRules.map((rule) => rule.widths))),
  depth: uniqueNumbers(flatten(typeCabinetRules.map((rule) => rule.depths))),
  height: uniqueNumbers(flatten(typeCabinetRules.map((rule) => rule.heights))),
  drawers: Array.from(new Set(typeCabinetRules.flatMap((rule) => rule.drawers))),
};

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
