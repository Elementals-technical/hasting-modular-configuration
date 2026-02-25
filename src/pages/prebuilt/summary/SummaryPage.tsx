import { useCallback, useEffect, useMemo, useState } from "react";

import { Hint } from "@/shared/ui/Hint/Hint";
import base_img from "../../../shared/assets/images/png/descr_image.png";
import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getActiveCabinetType,
  getCabinetColor,
  getCabinetColorSku,
  getCountertopColorSku,
  getCountertopStyle,
  // getDividersOption,
  // getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getBookMatching,
  getHandleGrooveColor,
  getHandleGrooveColorSku,
  getPriceBySku,
  getProductsPresets,
  getSelectedProducts,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSidePanelsOption,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
  getPlacedDividers,
} from "@/entities/product/model/store/selectors";
// import { dividersMockData } from "@/pages/prebuilt/accessories/constants";
import dataMaterial from "@/shared/constants/DataMaterial.json";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import {
  buildProductSku,
  buildCountertopSku,
  buildVesselSku,
  vesselHeightCmMap,
  buildTowelBarSku,
  TOWEL_BAR_DEFAULTS,
  buildSidePanelSku,
  SIDE_PANEL_WIDTH_CM,
  buildDividerSku,
  buildBookMatchingSku,
  extractColorCode,
} from "@/shared/lib/sku";
import { useGetConfiguratorQuery } from "@/entities";

import s from "./SummaryPage.module.scss";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;

  return imagePath;
};

// const resolveDividerImage = (selection?: string) => {
//   if (!selection) return undefined;
//   const match = dividersMockData.find((option) => option.title === selection);
//   return match?.metadata?.image;
// };

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$0";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

/** SKU prefixes whose dimension values are stored in centimeters */
const CM_SKU_PREFIXES = ["VAN-URSTD-", "VAN-URTWLBR-", "VAN-URSP-"];

const formatInches = (cm: number): string => {
  const inches = Math.round((cm / 2.54) * 10) / 10;
  if (Number.isInteger(inches)) return String(inches);
  const str = inches.toFixed(1);
  return str.startsWith("0.") ? str.slice(1) : str;
};

/** Converts dimension values (W/H/D) from cm to inches for SKUs that store cm.
 *  SKUs that already use inches (CT-, VES-) are returned unchanged. */
const convertSkuToInches = (sku: string): string => {
  if (!CM_SKU_PREFIXES.some((prefix) => sku.startsWith(prefix))) return sku;
  return sku.replace(/-(\d+(?:\.\d+)?)(W|H|D)(?=-|$)/g, (_, value, unit) => {
    return `-${formatInches(parseFloat(value))}${unit}`;
  });
};

type SummaryItem = {
  id: string;
  title: string;
  subtitle?: string;
  sku?: string;
  swatch?: {
    label: string;
    value: string;
    color: string;
    image?: string;
  };
  price: string;
  copyable?: boolean;
  description?: Record<string, unknown>;
};

type SummarySection = {
  id: string;
  title: string;
  items: SummaryItem[];
  copyLabel?: string;
};

/** Human-readable labels for handle types */
const handleLabelMap: Record<string, string> = {
  handle_urban_topcut: "Urban Top Cut",
  handle_urban_botcut: "Center Groove",
  handle_pto: "Push to Open",
};

/** Human-readable labels for drawer configs */
const drawerLabelMap: Record<string, string> = {
  "1D": "1 Drawer",
  "2D": "2 Drawer",
  "1DWID": "1 Wide Drawer",
};

/** Human-readable labels for material SKU codes */
const materialSkuLabelMap: Record<string, string> = {
  LACG: "Lacquered Gloss",
  LACM: "Lacquered Matt",
  FX: "Fenix",
  HPL: "HPL",
  POR: "Porcelain",
  GLSM: "Glass Matt",
  GLSG: "Glass Gloss",
  SSMLM: "Minermalmaro",
  SSTM: "Teckormud",
  SSOCR: "Ocritech",
  SSTKR: "Tekorlux",
};

/** Human-readable labels for side panel groove types */
const sidePanelLabelMap: Record<string, string> = {
  NoG: "No Groove",
  UpperG: "Upper Groove",
  CenterG: "Center Groove",
  DoubleG: "Double Groove",
};

const swatches = [
  { id: "sw-1", name: "Bianco", color: "#d9d7cd" },
  { id: "sw-2", name: "Latte", color: "#d1cbbe" },
  { id: "sw-3", name: "Mushroom", color: "#c0baad" },
  { id: "sw-4", name: "Grigio", color: "#9e9b92" },
  { id: "sw-5", name: "Caffe", color: "#857868" },
  { id: "sw-6", name: "Nero", color: "#756c60" },
];

export const SummaryPage = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const priceBySku = useAppSelector(getPriceBySku);
  const productsPresets = useAppSelector(getProductsPresets);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedDimensions = useAppSelector(getSelectedDimensions);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const cabinetColor = useAppSelector(getCabinetColor);
  const cabinetColorSku = useAppSelector(getCabinetColorSku);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const handleGrooveColorSku = useAppSelector(getHandleGrooveColorSku);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const sinkType = useAppSelector(getSinkType);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const bookMatching = useAppSelector(getBookMatching);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const placedDividers = useAppSelector(getPlacedDividers);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);

  const [productConfigs, setProductConfigs] = useState<Array<Record<string, unknown>>>([]);

  const handleCopy = (text: string, id: string) => {
    if (!navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const resolveItemPrice = useCallback((sku?: string) => (sku ? formatPrice(priceBySku[sku]) : "$0"), [priceBySku]);

  const materialLookup = useMemo(() => {
    const values = (dataMaterial as { materials?: any[] }).materials ?? [];
    const map = new Map<string, { hex?: string; image?: string; label?: string }>();
    const scoreEntry = (entry?: { hex?: string; image?: string; label?: string }) => {
      if (!entry) return 0;
      return (entry.image ? 2 : 0) + (entry.hex ? 1 : 0) + (entry.label ? 1 : 0);
    };

    values.forEach((option) => {
      (option.valuesArray ?? []).forEach((entry: any) => {
        const key = entry.metadata?.value ?? entry.value;
        if (!key) return;
        const next = { hex: entry.metadata?.hex, image: entry.metadata?.image, label: entry.label };
        const existing = map.get(key);
        if (!existing || scoreEntry(next) > scoreEntry(existing)) {
          map.set(key, next);
        }
      });
    });

    return map;
  }, []);

  const resolveSwatch = useCallback(
    (value: string) => {
      const entry = materialLookup.get(value);
      return {
        color: entry?.hex ?? "#dcdcdc",
        image: buildImageSrc(entry?.image),
        label: entry?.label ?? value,
        value,
      };
    },
    [materialLookup],
  );

  const { data: cabinetColors } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const colorSkuByName = useMemo(() => {
    const map = new Map<string, string>();
    const groups = cabinetColors?.availableOptions ?? [];

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;
          const meta = (variant.metadata ?? {}) as Record<string, unknown>;
          const value = (meta.value as string) || variant.name;
          const sku = (meta.sku as string) || "";
          if (value && sku) {
            map.set(value, sku);
          }
        });
      });
    });

    return map;
  }, [cabinetColors]);

  useEffect(() => {
    let isMounted = true;

    const loadConfigs = async () => {
      if (!selectedProducts.length) {
        if (isMounted) setProductConfigs([]);
        return;
      }

      const configs = await Promise.all(
        selectedProducts.map(async (id) => {
          const config = await getConfig(id);
          return config ? { _productId: id, ...config } : null;
        }),
      );
      const cleaned = configs.filter((config): config is Record<string, unknown> => Boolean(config));
      if (isMounted) setProductConfigs(cleaned);
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, [selectedProducts]);

  const buildCabinetDescription = useCallback(
    (opts: {
      cabinetType: string | null;
      drawers: string | null;
      handle: string | null;
      pattern: string | null;
      width: number | null;
      height: number | null;
      depth: number | null;
      cabColor: string;
      cabMaterialSku: string | null;
      hdlColor: string;
      hdlMaterialSku: string | null;
    }): Record<string, unknown> => {
      const elements: Record<string, string>[] = [];
      if (opts.cabMaterialSku) {
        elements.push({
          "Product Elements": "Cabinet",
          Material: materialSkuLabelMap[opts.cabMaterialSku] ?? opts.cabMaterialSku,
          "Color Code": opts.cabColor,
        });
      }
      if (opts.hdlMaterialSku) {
        elements.push({
          "Product Elements": "Handle",
          Material: materialSkuLabelMap[opts.hdlMaterialSku] ?? opts.hdlMaterialSku,
          "Color Code": opts.hdlColor,
        });
      }
      return {
        "Product Category": "Vanity",
        Products: "Urban Standard",
        "Cabinet Type": opts.cabinetType?.replace(/-/g, " ") ?? "Unknown",
        "Cabinet Style": opts.drawers ? (drawerLabelMap[opts.drawers] ?? opts.drawers) : "Unknown",
        "Handle Style": opts.handle ? (handleLabelMap[opts.handle] ?? opts.handle) : "Unknown",
        "Drawer Panel Fluting": opts.pattern || "None",
        Width: opts.width,
        Height: opts.height,
        Depth: opts.depth,
        elements,
      };
    },
    [],
  );

  const summarySections: SummarySection[] = useMemo(() => {
    const grainSku = grainDirection === "GrainHorizontal" ? "H" : grainDirection === "GrainVertical" ? "V" : null;
    const cabinetConfigs = productConfigs.filter((config) => config.category === "cabinets");
    const cabinetCount =
      cabinetConfigs.length > 0 ? cabinetConfigs.length : productsPresets.length > 0 ? productsPresets.length : 1;

    const cabinetItems =
      cabinetConfigs.length > 0
        ? cabinetConfigs.map((config, index) => {
            const width = typeof config.Width === "number" ? config.Width : undefined;
            const depth = typeof config.Depth === "number" ? config.Depth : undefined;
            const height = typeof config.Height === "number" ? config.Height : undefined;
            const drawers = typeof config.Drawers === "string" ? config.Drawers : "";

            const dims = [width, depth, height].every((v) => v !== undefined) ? `${width}x${depth}x${height}` : "";
            const subtitle = [drawers, dims].filter(Boolean).join(" | ");
            const resolveNameFromRaw = (v: string) => {
              const lastDash = v.lastIndexOf("-");
              if (lastDash > 0 && v.slice(lastDash + 1).length >= 6) return v.slice(0, lastDash);
              return v;
            };
            const name =
              typeof config.ProductType === "string"
                ? config.ProductType
                : typeof config.productType === "string"
                  ? config.productType
                  : typeof config.entityName === "string"
                    ? resolveNameFromRaw(config.entityName)
                    : typeof config._productId === "string"
                      ? resolveNameFromRaw(config._productId)
                      : typeof config.name === "string"
                        ? config.name
                        : undefined;
            const swatchValue =
              typeof config.CabinetColor === "string" && config.CabinetColor ? config.CabinetColor : cabinetColor;
            const swatch = resolveSwatch(swatchValue);

            const productCabinetType = name ?? activeCabinetType;

            const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

            const sku = buildProductSku({
              cabinetType: productCabinetType,
              drawers: typeof config.Drawers === "string" ? config.Drawers : null,
              handle: typeof config.Handle === "string" ? config.Handle : null,
              pattern:
                typeof config.DrawerPanelFluting === "string" ? config.DrawerPanelFluting : drawerPanelFluting || null,
              width: width ?? null,
              height: height ?? null,
              depth: depth ?? null,
              cab: cabinetColorSku
                ? { materialSku: cabinetColorSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
                : null,
              hdl: handleMaterialSku
                ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
                : null,
              msp: null,
              bkpl: null,
            });

            return {
              id: `cabinet-${index}`,
              title: (name ?? activeCabinetType)?.replace(/-/g, " ") ?? "Cabinet",
              subtitle,
              sku,
              swatch: {
                label: "Cabinet",
                value: swatch.value,
                color: swatch.color,
                image: swatch.image,
              },
              price: resolveItemPrice(sku),
              copyable: true,
              description: buildCabinetDescription({
                cabinetType: productCabinetType,
                drawers: typeof config.Drawers === "string" ? config.Drawers : null,
                handle: typeof config.Handle === "string" ? config.Handle : null,
                pattern:
                  typeof config.DrawerPanelFluting === "string"
                    ? config.DrawerPanelFluting
                    : drawerPanelFluting || null,
                width: width ?? null,
                height: height ?? null,
                depth: depth ?? null,
                cabColor: swatchValue,
                cabMaterialSku: cabinetColorSku || null,
                hdlColor: handleGrooveColor,
                hdlMaterialSku: handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null,
              }),
            };
          })
        : productsPresets.length > 0
          ? productsPresets.map((preset, index) => {
              const drawers = preset.Drawers ? `${preset.Drawers}` : "";
              const dims = [preset.Width, preset.Depth, preset.Height].every((v) => v !== undefined)
                ? `${preset.Width}x${preset.Depth}x${preset.Height}`
                : "";
              const subtitle = [drawers, dims].filter(Boolean).join(" | ");
              const swatchValue = preset.CabinetColor ?? cabinetColor;
              const swatch = resolveSwatch(swatchValue);

              const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

              const sku = buildProductSku({
                cabinetType: preset.name ?? activeCabinetType,
                drawers: preset.Drawers ?? null,
                handle: preset.Handle ?? null,
                pattern: drawerPanelFluting || null,
                width: preset.Width ?? null,
                height: preset.Height ?? null,
                depth: preset.Depth ?? null,
                cab: cabinetColorSku
                  ? { materialSku: cabinetColorSku, colorCode: extractColorCode(swatchValue), grainDirection: grainSku }
                  : null,
                hdl: handleMaterialSku
                  ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
                  : null,
                msp: null,
                bkpl: null,
              });

              return {
                id: `cabinet-${index}`,
                title: preset.name ?? activeCabinetType?.replace(/-/g, " ") ?? "Cabinet",
                subtitle,
                sku,
                swatch: {
                  label: "Cabinet",
                  value: swatch.value,
                  color: swatch.color,
                  image: swatch.image,
                },
                price: resolveItemPrice(sku),
                copyable: true,
                description: buildCabinetDescription({
                  cabinetType: preset.name ?? activeCabinetType,
                  drawers: preset.Drawers ?? null,
                  handle: preset.Handle ?? null,
                  pattern: drawerPanelFluting || null,
                  width: preset.Width ?? null,
                  height: preset.Height ?? null,
                  depth: preset.Depth ?? null,
                  cabColor: swatchValue,
                  cabMaterialSku: cabinetColorSku || null,
                  hdlColor: handleGrooveColor,
                  hdlMaterialSku: handleMaterialSku,
                }),
              };
            })
          : [
              (() => {
                const handleMaterialSku = handleGrooveColorSku || colorSkuByName.get(handleGrooveColor) || null;

                const sku = buildProductSku({
                  cabinetType: activeCabinetType,
                  drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
                  handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
                  pattern: drawerPanelFluting || null,
                  width: selectedDimensions.width,
                  height: selectedDimensions.height,
                  depth: selectedDimensions.depth,
                  cab: cabinetColorSku
                    ? {
                        materialSku: cabinetColorSku,
                        colorCode: extractColorCode(cabinetColor),
                        grainDirection: grainSku,
                      }
                    : null,
                  hdl: handleMaterialSku
                    ? { materialSku: handleMaterialSku, colorCode: extractColorCode(handleGrooveColor) }
                    : null,
                  msp: null,
                  bkpl: null,
                });

                return {
                  id: "cabinet-1",
                  title:
                    typeof selectedProductConfig?.name === "string"
                      ? selectedProductConfig.name
                      : (activeCabinetType?.replace(/-/g, " ") ?? "Cabinet"),
                  subtitle: `${typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : ""} | ${selectedDimensions.width ?? "-"}x${selectedDimensions.depth ?? "-"}x${selectedDimensions.height ?? "-"}`,
                  sku,
                  swatch: {
                    ...resolveSwatch(cabinetColor),
                    label: "Cabinet",
                    value: cabinetColor,
                  },
                  price: resolveItemPrice(sku),
                  copyable: true,
                  description: buildCabinetDescription({
                    cabinetType: activeCabinetType,
                    drawers: typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null,
                    handle: typeof selectedProductConfig?.Handle === "string" ? selectedProductConfig.Handle : null,
                    pattern: drawerPanelFluting || null,
                    width: selectedDimensions.width,
                    height: selectedDimensions.height,
                    depth: selectedDimensions.depth,
                    cabColor: cabinetColor,
                    cabMaterialSku: cabinetColorSku || null,
                    hdlColor: handleGrooveColor,
                    hdlMaterialSku: handleMaterialSku,
                  }),
                };
              })(),
            ];

    const countertopSwatch = resolveSwatch(countertopColor);

    const cabinetOptionItems: SummaryItem[] = [
      drawerPanelFluting
        ? {
            id: "cabinet-option-drawer-panel",
            title: "Drawer Panel Fluting",
            subtitle: drawerPanelFluting,
          }
        : null,
      grainDirection
        ? {
            id: "cabinet-option-grain-direction",
            title: "Grain Direction",
            subtitle: grainDirection,
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    const totalCountertopWidth =
      cabinetConfigs.length > 0
        ? cabinetConfigs.reduce((sum, c) => sum + (typeof c.Width === "number" ? c.Width : 0), 0) || null
        : productsPresets.length > 0
          ? productsPresets.reduce((sum, p) => sum + (p.Width ?? 0), 0) || null
          : selectedDimensions.width;

    const countertopSkuLines = buildCountertopSku({
      style: countertopStyle || null,
      width: totalCountertopWidth,
      depth: selectedDimensions.depth,
      thickness: countertopThickness || null,
      basinType: sinkType || null,
      faucetHolesAmount: faucetHolesAmount || null,
      faucetHolesSpacing: faucetHolesSpacing || null,
      countertopMaterialSku: countertopColorSku || null,
      countertopColorCode: extractColorCode(countertopColor),
    });

    const vesselSku = sinkType?.startsWith("Vessel_")
      ? buildVesselSku({
          vesselType: sinkType,
          width: totalCountertopWidth,
          height: vesselHeightCmMap[sinkType] ?? null,
          depth: selectedDimensions.depth,
          materialSku: null,
          colorCode: null,
        })
      : null;

    const countertopSkuLabels = ["Countertop", "Basin", "Faucet Hole Quantity", "Faucet Hole Spacing", "Hole Cutout"];

    const countertopItems: SummaryItem[] = [
      {
        id: "countertop-1",
        title: "Countertop",
        subtitle: countertopThickness ? `${countertopThickness}` : undefined,
        sku: countertopSkuLines[0],
        swatch: {
          label: "Countertop",
          value: countertopColor,
          color: countertopSwatch.color,
          image: countertopSwatch.image,
        },
        price: resolveItemPrice(countertopSkuLines[0]),
        copyable: true,
        description: {
          "Product Category": "Countertop",
          Style: countertopStyle || "Plain",
          Width: totalCountertopWidth,
          Thickness: countertopThickness || null,
          Depth: selectedDimensions.depth,
          Material: countertopColorSku ? (materialSkuLabelMap[countertopColorSku] ?? countertopColorSku) : null,
          "Color Code": countertopColor,
        },
      },
      countertopStyle
        ? {
            id: "countertop-style",
            title: "Countertop Style",
            subtitle: countertopStyle,
          }
        : null,
      ...countertopSkuLines.slice(1).map((line, i) => ({
        id: `countertop-sku-${i + 1}`,
        title: countertopSkuLabels[i + 1] ?? `Countertop Element`,
        subtitle: line,
        sku: line,
        price: resolveItemPrice(line),
        copyable: true,
        description: {
          "Product Category": countertopSkuLabels[i + 1] ?? "Countertop Element",
        },
      })),
    ].filter(Boolean) as SummaryItem[];

    // Towel bar full product SKUs
    const towelMaterialSku = colorSkuByName.get(towelBarColor) || null;
    const towelColorCode = extractColorCode(towelBarColor);
    const hasTowel = towelBarOption && towelBarOption !== "None";
    const hasRight = towelBarOption === "Right" || towelBarOption === "Both";
    const hasLeft = towelBarOption === "Left" || towelBarOption === "Both";

    const towelBarRightSku =
      hasTowel && hasRight && towelMaterialSku
        ? buildTowelBarSku({
            side: "R",
            width: TOWEL_BAR_DEFAULTS.width,
            height: TOWEL_BAR_DEFAULTS.height,
            depth: TOWEL_BAR_DEFAULTS.depth,
            materialSku: towelMaterialSku,
            colorCode: towelColorCode,
          })
        : null;

    const towelBarLeftSku =
      hasTowel && hasLeft && towelMaterialSku
        ? buildTowelBarSku({
            side: "L",
            width: TOWEL_BAR_DEFAULTS.width,
            height: TOWEL_BAR_DEFAULTS.height,
            depth: TOWEL_BAR_DEFAULTS.depth,
            materialSku: towelMaterialSku,
            colorCode: towelColorCode,
          })
        : null;

    // Side panel SKUs — one per unique dimension set
    const sidePanelSkuItems: SummaryItem[] = [];
    if (sidePanelsOption && sidePanelsOption !== "None") {
      const dimsList =
        cabinetConfigs.length > 0
          ? cabinetConfigs.map((c) => ({
              height: typeof c.Height === "number" ? c.Height : null,
              depth: typeof c.Depth === "number" ? c.Depth : null,
            }))
          : productsPresets.length > 0
            ? productsPresets.map((p) => ({ height: p.Height ?? null, depth: p.Depth ?? null }))
            : [{ height: selectedDimensions.height, depth: selectedDimensions.depth }];

      const seenSpSkus = new Set<string>();
      dimsList.forEach((dims, idx) => {
        const spSku = buildSidePanelSku({
          panelType: sidePanelsOption,
          width: SIDE_PANEL_WIDTH_CM,
          height: dims.height,
          depth: dims.depth,
        });
        if (spSku && !seenSpSkus.has(spSku)) {
          seenSpSkus.add(spSku);
          sidePanelSkuItems.push({
            id: `accessories-side-panel-${idx}`,
            title: "Side Panel",
            subtitle: spSku,
            sku: spSku,
            price: resolveItemPrice(spSku),
            copyable: true,
            description: {
              "Product Category": "Side Panel",
              "Panel Type": sidePanelLabelMap[sidePanelsOption] ?? sidePanelsOption,
              Width: SIDE_PANEL_WIDTH_CM,
              Height: dims.height,
              Depth: dims.depth,
            },
          });
        }
      });
    }

    const typeToStyleMap: Record<string, string> = { A: "Option A", B: "Option B", C: "Option C" };

    const dividerItems: SummaryItem[] = placedDividers.map((divider, index) => {
      const style = typeToStyleMap[divider.type];
      const sku = style ? buildDividerSku({ dividerStyle: style }) : null;
      // const image = buildImageSrc(resolveDividerImage(style));
      const unitPrice = sku ? (priceBySku[sku] ?? 0) : 0;
      return {
        id: `accessories-dividers-${divider.key}-${index}`,
        title: "Dividers",
        subtitle: sku ?? undefined,
        sku: sku ?? undefined,
        // swatch: style && image ? { label: "Divider", value: style, color: "#ffffff", image } : undefined,
        price: formatPrice(unitPrice),
        copyable: !!sku,
        description: { "Product Category": "Divider", "Divider Style": style },
      };
    });

    const accessoriesItems: SummaryItem[] = [
      ...sidePanelSkuItems,
      ...dividerItems,
      towelBarRightSku
        ? {
            id: "accessories-towel-bar-right",
            title: "Towel Bar Right",
            subtitle: towelBarRightSku,
            sku: towelBarRightSku,
            price: resolveItemPrice(towelBarRightSku),
            copyable: true,
            description: {
              "Product Category": "Towel Bar",
              Side: "Right",
              Width: TOWEL_BAR_DEFAULTS.width,
              Height: TOWEL_BAR_DEFAULTS.height,
              Depth: TOWEL_BAR_DEFAULTS.depth,
              Material: towelMaterialSku ? (materialSkuLabelMap[towelMaterialSku] ?? towelMaterialSku) : null,
              "Color Code": towelBarColor,
            },
          }
        : null,
      towelBarLeftSku
        ? {
            id: "accessories-towel-bar-left",
            title: "Towel Bar Left",
            subtitle: towelBarLeftSku,
            sku: towelBarLeftSku,
            price: resolveItemPrice(towelBarLeftSku),
            copyable: true,
            description: {
              "Product Category": "Towel Bar",
              Side: "Left",
              Width: TOWEL_BAR_DEFAULTS.width,
              Height: TOWEL_BAR_DEFAULTS.height,
              Depth: TOWEL_BAR_DEFAULTS.depth,
              Material: towelMaterialSku ? (materialSkuLabelMap[towelMaterialSku] ?? towelMaterialSku) : null,
              "Color Code": towelBarColor,
            },
          }
        : null,
      bookMatching === "enabled" && grainSku && (grainSku !== "H" || cabinetCount >= 2)
        ? (() => {
            const bmSku = buildBookMatchingSku({ direction: grainSku });
            return {
              id: "accessories-book-matching",
              title: "Book Matching",
              subtitle: bmSku,
              sku: bmSku,
              price: resolveItemPrice(bmSku),
              copyable: true,
              description: {
                "Product Category": "Book Matching",
                Direction: grainSku === "H" ? "Horizontal" : "Vertical",
              },
            };
          })()
        : null,
    ].filter(Boolean) as SummaryItem[];

    const faucetItems: SummaryItem[] = [
      faucetHolesAmount
        ? {
            id: "faucet-holes-amount",
            title: "Faucet Holes Amount",
            subtitle: faucetHolesAmount,
            price: "$0",
          }
        : null,
      faucetHolesSpacing
        ? {
            id: "faucet-holes-spacing",
            title: "Faucet Holes Spacing",
            subtitle: faucetHolesSpacing,
            price: "$0",
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    return [
      {
        id: "cabinet",
        title: "Cabinet",
        copyLabel: "Copy sku and description",
        items: cabinetItems,
      },
      ...(cabinetOptionItems.length
        ? [
            {
              id: "cabinet-options",
              title: "Cabinet Options",
              items: cabinetOptionItems,
            },
          ]
        : []),
      {
        id: "countertop",
        title: "Countertop",
        items: countertopItems,
      },
      {
        id: "basin",
        title: "Basin",
        items: [
          {
            id: "basin-1",
            title: "Basin",
            subtitle: sinkType || undefined,
            price: "$0",
          },
          ...(vesselSku
            ? [
                {
                  id: "basin-vessel-sku",
                  title: "Vessel",
                  subtitle: vesselSku,
                  sku: vesselSku,
                  price: resolveItemPrice(vesselSku),
                  copyable: true,
                  description: { "Product Category": "Vessel", Type: sinkType },
                },
              ]
            : []),
        ],
      },
      {
        id: "accessories",
        title: "Accessories",
        items: accessoriesItems,
      },
      ...(faucetItems.length
        ? [
            {
              id: "faucet",
              title: "Faucet",
              items: faucetItems,
            },
          ]
        : []),
    ];
  }, [
    activeCabinetType,
    cabinetColor,
    cabinetColorSku,
    countertopColorSku,
    countertopColor,
    countertopThickness,
    countertopStyle,
    drawerPanelFluting,
    faucetHolesAmount,
    faucetHolesSpacing,
    grainDirection,
    bookMatching,
    handleGrooveColor,
    handleGrooveColorSku,
    productsPresets,
    productConfigs,
    colorSkuByName,
    selectedDimensions.depth,
    selectedDimensions.height,
    selectedDimensions.width,
    selectedProductConfig,
    sidePanelsOption,
    sinkType,
    towelBarColor,
    towelBarOption,
    placedDividers,
    priceBySku,
    resolveSwatch,
    resolveItemPrice,
    buildCabinetDescription,
  ]);

  const fullSkuJson = useMemo(() => {
    return summarySections
      .flatMap((section) => section.items)
      .filter((item) => item.sku && item.copyable)
      .map((item) => ({
        sku: item.sku,
        skuInches: convertSkuToInches(item.sku!),
        description: item.description ?? {},
      }));
  }, [summarySections]);

  // Prices are fetched reactively by usePriceCalculation hook in ConfiguratorSidebar.
  // This page only reads from the store.

  return (
    <div id="summary-content" className={s.summaryPage}>
      {summarySections.map((section) => (
        <div key={section.id} className={s.section}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitle}>{section.title}</div>
          </div>

          <div className={s.sectionList}>
            {section.items.map((item) => {
              return (
                <div key={item.id} className={`${s.itemRow} ${!item.swatch ? s.noSwatch : ""}`}>
                  <div className={s.itemInfo}>
                    <span className={s.bullet}>
                      <img src={base_img} alt="#" />
                    </span>

                    <div className={s.itemTexts}>
                      <div className={s.itemTitle}>{item.title}</div>
                      {item.subtitle && <div className={s.itemSubtitle}>{item.subtitle}</div>}
                    </div>

                    {item.copyable && item.sku && (
                      <Hint className={s.copyHint} content={"Copy SKU"}>
                        <button
                          className={`${s.copyButton} ${copiedId === item.id ? s.copied : ""}`}
                          onClick={() =>
                            handleCopy(
                              JSON.stringify(
                                { sku: item.sku, skuInches: convertSkuToInches(item.sku!) },
                                null,
                                2,
                              ),
                              item.id,
                            )
                          }
                          aria-label="Copy SKU"
                        >
                          <span className={s.copyIcon} />
                        </button>
                      </Hint>
                    )}
                  </div>

                  {item.swatch && (
                    <div className={s.swatch}>
                      <span
                        className={s.swatchColor}
                        style={{
                          backgroundColor: item.swatch.color,
                          backgroundImage: item.swatch.image ? `url(${item.swatch.image})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div>
                        <div className={s.swatchLabel}>{item.swatch.label}</div>
                        <div className={s.swatchValue}>{item.swatch.value}</div>
                      </div>
                    </div>
                  )}

                  <div className={s.price}>
                    {item.sku && item.price === "$0" ? <span className={s.priceSpinner} /> : item.price}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitle}>Swatches</div>
        </div>

        <p className={s.sectionHint}>We will add to your swatch cart with your selected finishes</p>

        <label className={s.addSwatches}>
          <input type="checkbox" />
          <span className={s.addLabel}>Add free swatches</span>
        </label>

        <div className={s.swatchesListHeader}>Swatches list</div>

        <div className={s.swatchesList}>
          {swatches.map((swatch) => (
            <div key={swatch.id} className={s.swatchTile}>
              <span className={s.tileColor} style={{ backgroundColor: swatch.color }} />
              {/* <span className={s.tileLabel}>{swatch.name}</span> */}
            </div>
          ))}
        </div>
      </div>

      <div className={s.copyAllSection}>
        <button
          className={`${s.copyAllButton} ${copiedId === "copy-all" ? s.copiedAll : ""}`}
          onClick={() => handleCopy(JSON.stringify(fullSkuJson, null, 2), "copy-all")}
        >
          {copiedId === "copy-all" ? "Copied!" : "Copy All SKU"}
        </button>
      </div>
    </div>
  );
};
