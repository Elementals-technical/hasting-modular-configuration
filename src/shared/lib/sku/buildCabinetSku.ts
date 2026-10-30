import type { SkuProfile } from "./skuProfile";
// import { cmToInches } from "./cmToInches";

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

const CATEGORY = "VAN";

export function buildCabinetSku(profile: SkuProfile, input: CabinetSkuInput): string {
  const { cabinetMappings } = profile;
  const { fallback } = profile.series;

  const resolve = (map: Record<string, string>, value: string | null): string => {
    if (!value) return fallback;

    return map[value] ?? fallback;
  };

  // Config block: CabinetType/CabinetStyle/HandleStyle/DrawerPanelFluting
  const type = resolve(cabinetMappings.cabinetType, input.cabinetType);
  const drawers = resolve(cabinetMappings.drawer, input.drawers);
  const handle = resolve(cabinetMappings.handle, input.handle);
  const pattern = resolve(cabinetMappings.pattern, input.pattern);

  const configBlock = [type, drawers, handle, pattern].join("/");

  // Dimensions: cm
  // TODO: uncomment cmToInches when backend switches to inches
  // const w = input.width != null ? `${cmToInches(input.width)}W` : `${fallback}W`;
  // const h = input.height != null ? `${cmToInches(input.height)}H` : `${fallback}H`;
  // const d = input.depth != null ? `${cmToInches(input.depth)}D` : `${fallback}D`;
  const w = input.width != null ? `${input.width}W` : `${fallback}W`;
  const h = input.height != null ? `${input.height}H` : `${fallback}H`;
  const d = input.depth != null ? `${input.depth}D` : `${fallback}D`;

  // Product elements
  const sidePanel = resolve(cabinetMappings.sidePanel, input.sidePanel);
  const divider = resolve(cabinetMappings.divider, input.divider);
  const towelBar = resolve(cabinetMappings.towelBar, input.towelBar);

  const elements = [sidePanel, divider, towelBar].filter((v) => v !== fallback);
  const elementsSuffix = elements.length ? `-${elements.join("-")}` : "";

  // Material block: CAB-{MaterialSKU} (color code will be added later)
  const cabMaterial = input.cabinetMaterialSku?.trim() || null;
  const cabBlock = cabMaterial ? `-CAB-${cabMaterial}` : "";

  return `${CATEGORY}-${profile.series.cabinet}-${configBlock}-${w}-${h}-${d}${elementsSuffix}${cabBlock}`;
}
