type MaterialLookupEntry = {
  hex?: string;
  image?: string;
  label?: string;
};

type ExtraMaterialLookupEntry = {
  value: string;
  entry: MaterialLookupEntry;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const scoreEntry = (entry?: MaterialLookupEntry) => {
  if (!entry) return 0;
  return (entry.image ? 2 : 0) + (entry.hex ? 1 : 0) + (entry.label ? 1 : 0);
};

export const buildMaterialLookup = (
  source: unknown,
  extraEntries: ExtraMaterialLookupEntry[] = [],
): Map<string, MaterialLookupEntry> => {
  const map = new Map<string, MaterialLookupEntry>();
  if (!isRecord(source) || !Array.isArray(source.materials)) {
    extraEntries.forEach(({ value, entry }) => map.set(value, entry));
    return map;
  }

  source.materials.forEach((option) => {
    if (!isRecord(option) || !Array.isArray(option.valuesArray)) return;

    option.valuesArray.forEach((entry) => {
      if (!isRecord(entry)) return;

      const metadata = isRecord(entry.metadata) ? entry.metadata : {};
      const key = readString(metadata, "value") ?? readString(entry, "value");
      if (!key) return;

      const next = {
        hex: readString(metadata, "hex"),
        image: readString(metadata, "image"),
        label: readString(entry, "label"),
      };
      const existing = map.get(key);
      if (!existing || scoreEntry(next) > scoreEntry(existing)) {
        map.set(key, next);
      }
    });
  });

  extraEntries.forEach(({ value, entry }) => map.set(value, entry));

  return map;
};
