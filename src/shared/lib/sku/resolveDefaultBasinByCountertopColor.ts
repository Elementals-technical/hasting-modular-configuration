import { extractColorCode } from "./extractColorCode";

const COLOR_CODE_TO_BASIN: Record<string, string> = {
  FF: "Top_Tekorlux_Rectangular",
};

export const resolveDefaultBasinByCountertopColor = (countertopColor?: string | null): string | null => {
  if (!countertopColor) return null;
  const colorCode = extractColorCode(countertopColor)?.toUpperCase() ?? "";
  if (!colorCode) return null;
  return COLOR_CODE_TO_BASIN[colorCode] ?? null;
};
