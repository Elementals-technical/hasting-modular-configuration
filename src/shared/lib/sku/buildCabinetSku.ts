import {
  cabinetTypeSkuMap,
  dividerSkuMap,
  drawerSkuMap,
  handleSkuMap,
  patternSkuMap,
  sidePanelSkuMap,
  towelBarSkuMap,
} from "./cabinetSkuMaps";

export type CabinetSkuInput = {
  cabinetType: string | null;
  drawers: string | null;
  handle: string | null;
  pattern: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sidePanel: string | null;
  divider: string | null;
  towelBar: string | null;
  /** Material SKU for cabinet body (e.g. "3D", "LACM", "LACG") */
  cabinetMaterialSku: string | null;
};

const FALLBACK = "X";
const CATEGORY = "VAN";
const SERIES = "URSTD";

const resolve = (map: Record<string, string>, value: string | null): string => {
  if (!value) return FALLBACK;

  return map[value] ?? FALLBACK;
};

export function buildCabinetSku(input: CabinetSkuInput): string {
  // Config block: CabinetType/CabinetStyle/HandleStyle/DrawerPanelFluting
  const type = resolve(cabinetTypeSkuMap, input.cabinetType);
  const drawers = resolve(drawerSkuMap, input.drawers);
  const handle = resolve(handleSkuMap, input.handle);
  const pattern = resolve(patternSkuMap, input.pattern);

  const configBlock = [type, drawers, handle, pattern].join("/");

  // Dimensions
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  // Product elements
  const sidePanel = resolve(sidePanelSkuMap, input.sidePanel);
  const divider = resolve(dividerSkuMap, input.divider);
  const towelBar = resolve(towelBarSkuMap, input.towelBar);

  const elements = [sidePanel, divider, towelBar].filter((v) => v !== FALLBACK);
  const elementsSuffix = elements.length ? `-${elements.join("-")}` : "";

  // Material block: CAB-{MaterialSKU} (color code will be added later)
  const cabMaterial = input.cabinetMaterialSku?.trim() || null;
  const cabBlock = cabMaterial ? `-CAB-${cabMaterial}` : "";

  return `${CATEGORY}-${SERIES}-${configBlock}-${w}-${h}-${d}${elementsSuffix}${cabBlock}`;
}
