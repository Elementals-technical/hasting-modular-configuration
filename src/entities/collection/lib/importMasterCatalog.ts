/** Normalizes a quoted tab-delimited product master without reading developer files at runtime. */
export type MasterOption = {
  value: string;
  label: string;
  group: string;
  category: string;
  filters: string[];
  order: number;
};
export type MasterCatalog = {
  schemaVersion: 1;
  collectionId: string;
  productId: string;
  source: string;
  rowCount: number;
  attributes: Record<string, MasterOption[]>;
};

/** Parses escaped quotes, embedded tabs/newlines, CRLF and BOM; rejects malformed records. */
export const parseMasterTable = (input: string, delimiter: "\t" | "," = "\t"): string[][] => {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(value);
    value = "";
    closed = false;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += char;
    } else if (char === delimiter || char === "\n") {
      cell();
      if (char === "\n") {
        if (row.some((entry) => entry !== "")) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Malformed master quoting");
      value += char;
    }
  }
  if (quoted) throw new Error("Unterminated master quote");
  if (value || closed || row.length) {
    cell();
    if (row.some((entry) => entry !== "")) rows.push(row);
  }
  return rows;
};

export const importMasterCatalog = (
  input: string,
  collectionId: string,
  productId: string,
  source: string,
): MasterCatalog => {
  const [headers, ...rows] = parseMasterTable(input);
  const required = [
    "ProductID",
    "3DOptionName",
    "3DOptionValue",
    "UIOptionValueLabel",
    "UIGroupingOptionName",
    "SelectionType",
    "UIOptionValueStyleFilters",
  ];
  if (!headers || new Set(headers).size !== headers.length || required.some((header) => !headers.includes(header))) {
    throw new Error("Master headers are missing or duplicated");
  }
  const attributes: Record<string, MasterOption[]> = {};
  rows.forEach((cells, order) => {
    if (cells.length !== headers.length) throw new Error(`Master row ${order + 2} has an invalid column count`);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index].trim()]));
    if (row.ProductID !== productId) throw new Error(`Unexpected ProductID on row ${order + 2}`);
    const attribute = row["3DOptionName"],
      value = row["3DOptionValue"],
      label = row["UIOptionValueLabel"];
    if (!attribute || !value || !label) throw new Error(`Missing option on row ${order + 2}`);
    const options = (attributes[attribute] ??= []);
    if (options.some((option) => option.value === value)) throw new Error(`Duplicate ${attribute} value: ${value}`);
    options.push({
      value,
      label,
      group: row.UIGroupingOptionName,
      category: row.SelectionType ?? "",
      filters: row.UIOptionValueStyleFilters.split(",")
        .map((filter) => filter.trim())
        .filter(Boolean),
      order,
    });
  });
  return { schemaVersion: 1, collectionId, productId, source, rowCount: rows.length, attributes };
};

const STYLE: Record<string, string> = {
  "1-Drawer": "1_drawer",
  "2-Drawer": "2_drawer",
  "Single basin": "single_basin",
  "Double basin": "double_basin",
  Asymmetrical: "asymmetrical",
};
const SIZE: Record<string, string> = {
  "24": "24_29",
  "30": "30_39",
  "40": "40_49",
  "50": "50_59",
  "60": "60_69",
  "70": "70_79",
  "80": "80_89",
  "90": "90_plus",
};

/** Content-based IDs stay stable when the master is reordered or extended. */
export const stableModelId = (sourceModel: string): number => {
  let hash = 2166136261;
  for (const char of sourceModel) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
};

/** Model names only supply filters/identity, never module layouts or substitute images. */
export const buildPendingPresets = (catalog: MasterCatalog) => {
  const models = catalog.attributes.Model ?? [];
  const ids = new Set<number>();
  return models.map((model) => {
    const id = stableModelId(model.value),
      size = SIZE[model.value.split("_").at(-1) ?? ""];
    const style = model.filters.map((filter) => {
      if (!STYLE[filter]) throw new Error(`Unknown model filter: ${filter}`);
      return STYLE[filter];
    });
    if (!size || ids.has(id)) throw new Error(`Invalid model identity or size: ${model.value}`);
    ids.add(id);
    return {
      id,
      sourceModel: model.value,
      title: model.label,
      img: "",
      isProductModel: true,
      presetProducts: [],
      size,
      style,
      availability: {
        status: "pending-handoff",
        reason: "Approved composition and image required from the 3D/product team.",
      },
    };
  });
};
