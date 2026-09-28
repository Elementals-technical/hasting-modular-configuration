import {
  isSyntesiCountertopMaterialSku,
  normalizeMaterialToken,
  resolveDefaultThicknessFromRules,
} from "@/features/configurator-rule-core/countertop";
import {
  buildCountertopSkuIfComplete,
  extractColorCode,
  getCountertopMaterialTokensBySku,
  getCountertopMaterialTokensFromBasinType,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopMaterialSkuFromBasinType,
  resolveCountertopMaterialSkuFromColorCode,
  type CountertopSkuInput,
  type SkuSeries,
} from "@/shared/lib/sku";

import type { PricingInput, PricingLine, PricingLineGroup } from "./types";

/**
 * The Urban Standard Height countertop (D02): its top, the integrated basin of each sink base,
 * the vessel cutout and the faucet holes, spelled `CT-{prefix}{material}-…`. USH prices its own
 * countertop with it, and so does a collection whose SKU profile prices its countertop as USH's
 * (Urban Low Height). Each caller brings its composition: the countertop's width and depth and
 * the basin of each sink base.
 */

/** The countertop as USH prices it: its material, colour code and thickness. */
export type UshCountertop = {
  /** The material of the countertop colour, or of the basin when the colour names none. */
  materialSku: string | null;
  /** The material the SKU carries: a colour code that decides the material wins over `materialSku`. */
  effectiveMaterialSku: string | null;
  colorCode: string | null;
  thickness: string | null;
  /** The material tokens the colour SKU and the basin point to; they pick among a colour's SKUs. */
  preferredMaterialTokens: string[];
  isSyntesi: boolean;
};

export type UshCountertopContext = {
  /** The countertop colour priced. */
  color: string;
  /** The basin that decides the material when the colour does not. */
  sinkType: string | null;
  /** The size the countertop table rules give the default thickness for. */
  width: number | null;
  depth: number | null;
};

export const resolveUshCountertop = (
  input: PricingInput,
  { color, sinkType, width, depth }: UshCountertopContext,
): UshCountertop => {
  const {
    activeProfile,
    colorSkuMaps: { countertopColorSkuCandidatesByValue },
    countertopColor,
    countertopColorSku,
    countertopRules,
    countertopStyle,
    countertopThickness,
    sceneConfigs,
  } = input;

  const preferredMaterialTokens = [
    ...getCountertopMaterialTokensBySku(countertopColorSku),
    ...getCountertopMaterialTokensFromBasinType(sinkType),
  ];
  const skuOfColor = (value: string) =>
    resolveCountertopColorSkuFromCandidates({
      value,
      candidatesByValue: countertopColorSkuCandidatesByValue,
      preferredMaterialTokens,
    });
  const materialSku =
    countertopColorSku ||
    skuOfColor(color) ||
    skuOfColor(countertopColor) ||
    resolveCountertopMaterialSkuFromBasinType(sinkType) ||
    null;
  const colorCode = extractColorCode(color);
  const effectiveMaterialSku = resolveCountertopMaterialSkuFromColorCode(colorCode) ?? materialSku;

  const syntesiMaterial = activeProfile?.ruleData.syntesi?.material ?? null;
  const isSyntesi =
    syntesiMaterial !== null &&
    (isSyntesiCountertopMaterialSku(effectiveMaterialSku, activeProfile) ||
      normalizeMaterialToken(sinkType ?? "").includes(normalizeMaterialToken(syntesiMaterial)));

  const materialForThicknessRules = materialSku || resolveCountertopMaterialSkuFromBasinType(sinkType);
  const defaultThickness = resolveDefaultThicknessFromRules({
    rules: countertopRules,
    activeMaterialTokens: materialForThicknessRules ? [normalizeMaterialToken(materialForThicknessRules)] : [],
    width,
    depth,
    activeCountertopStyle: countertopStyle || null,
  });

  return {
    materialSku,
    effectiveMaterialSku,
    colorCode,
    thickness: countertopThickness || sceneConfigs[0]?.Thickness || defaultThickness || null,
    preferredMaterialTokens,
    isSyntesi,
  };
};

/** Position 0 of the countertop SKU lines is the top; the rest are told apart by their tokens. */
const countertopLineGroup = (sku: string, index: number): PricingLineGroup => {
  if (index === 0) return "countertop";
  if (sku.includes("-FAHO/")) return "faucetHoles";
  if (sku.endsWith("-HCUT")) return "holeCut";
  return "basin";
};

export type UshCountertopLinesInput = {
  series: SkuSeries;
  countertop: UshCountertop;
  style: string;
  faucetHolesAmount: string;
  /** The basin of the whole composition. */
  sinkType: string | null;
  /** The countertop across the composition, side panels included. */
  widthCm: number | null;
  depthCm: number | null;
  /** Each sink base and its basin: an integrated basin is ordered per sink base. */
  sinkBases: readonly { id: string; sinkType: string | null }[];
  sinkBaseCount: number;
};

export const buildUshCountertopLines = ({
  series,
  countertop,
  style,
  faucetHolesAmount,
  sinkType,
  widthCm,
  depthCm,
  sinkBases,
  sinkBaseCount,
}: UshCountertopLinesInput): PricingLine[] => {
  const lines: PricingLine[] = [];
  const add = ({ quantity = 1, ...line }: Omit<PricingLine, "quantity"> & { quantity?: number }) => {
    if (quantity > 0) lines.push({ ...line, quantity });
  };

  const skuLines = (basinType: string | null): string[] => {
    const skuInput: CountertopSkuInput = {
      style: style || null,
      width: widthCm,
      depth: depthCm,
      thickness: countertop.thickness,
      basinType,
      faucetHolesAmount: faucetHolesAmount || null,
      countertopMaterialSku: countertop.effectiveMaterialSku,
      countertopColorCode: countertop.colorCode,
    };
    return buildCountertopSkuIfComplete({ series }, skuInput);
  };
  const isVessel = (style || "").trim().toLowerCase() === "vessel";

  // The top of the whole composition, so the Summary line has a matching price key.
  const aggregateLines = skuLines(sinkType);
  aggregateLines.forEach((line, index) => {
    const isIntegratedBasinSkuLine = index === 1 && !isVessel;
    if (isIntegratedBasinSkuLine && countertop.isSyntesi) return;

    if (isIntegratedBasinSkuLine && sinkBases.length > 0) {
      sinkBases.forEach((entry) => {
        const basinLine = skuLines(entry.sinkType || null)[1] ?? line;
        add({ id: `countertop:basin:${entry.id}`, group: "basin", sku: basinLine });
      });
      return;
    }
    const group = countertopLineGroup(line, index);
    // A basin and a vessel cutout (HCUT) are ordered per sink base; the top and the faucet holes once.
    const repeatCount = group === "holeCut" || (group === "basin" && sinkType) ? sinkBaseCount : 1;
    add({
      id: `countertop:${index}`,
      group,
      sku: line,
      quantity: repeatCount,
      ...(index === 0 && widthCm != null ? { widthCm } : {}),
    });
  });

  // Always keep a default faucet-holes pricing SKU in the pool (including "0"),
  // with dynamic material resolved from basin/material context.
  const faucetHolesQty = (faucetHolesAmount ?? "").trim() || "0";
  const faucetMaterialSku =
    resolveCountertopMaterialSkuFromColorCode(countertop.colorCode) ??
    resolveCountertopMaterialSkuFromBasinType(sinkType) ??
    countertop.effectiveMaterialSku ??
    "HPL";
  const defaultFaucetSku = `CT-${series.countertopPrefix}${faucetMaterialSku}-FAHO/${faucetHolesQty}`;
  if (!aggregateLines.includes(defaultFaucetSku)) {
    add({ id: "countertop:faucetDefault", group: "faucetHoles", sku: defaultFaucetSku });
  }

  return lines;
};
