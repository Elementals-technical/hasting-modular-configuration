import { useEffect, useMemo, useState } from "react";

import { Hint } from "@/shared/ui/Hint/Hint";
import base_img from "../../../shared/assets/images/png/descr_image.png";
import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCabinetColor,
  getCountertopStyle,
  getDividersOption,
  getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getHandleGrooveColor,
  getLedOption,
  getProductsPresets,
  getSelectedProducts,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSidePanelsOption,
  getSinkType,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { dividersMockData } from "@/pages/prebuilt/accessories/constants";
import dataMaterial from "@/shared/constants/DataMaterial.json";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

import s from "./SummaryPage.module.scss";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;

  return imagePath;
};

const resolveDividerImage = (selection?: string) => {
  if (!selection) return undefined;
  const match = dividersMockData.find((option) => option.title === selection);
  return match?.metadata?.image;
};

type SummaryItem = {
  id: string;
  title: string;
  subtitle?: string;
  swatch?: {
    label: string;
    value: string;
    color: string;
    image?: string;
  };
  price: string;
  copyable?: boolean;
};

type SummarySection = {
  id: string;
  title: string;
  items: SummaryItem[];
  copyLabel?: string;
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

  const productsPresets = useAppSelector(getProductsPresets);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedDimensions = useAppSelector(getSelectedDimensions);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);

  const sinkType = useAppSelector(getSinkType);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const ledOption = useAppSelector(getLedOption);
  const dividersOption = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
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

  const resolveSwatch = (value: string) => {
    const entry = materialLookup.get(value);
    return {
      color: entry?.hex ?? "#dcdcdc",
      image: buildImageSrc(entry?.image),
      label: entry?.label ?? value,
      value,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadConfigs = async () => {
      if (!selectedProducts.length) {
        if (isMounted) setProductConfigs([]);
        return;
      }

      const configs = await Promise.all(selectedProducts.map((id) => getConfig(id)));
      const cleaned = configs.filter((config): config is Record<string, unknown> => Boolean(config));
      if (isMounted) setProductConfigs(cleaned);
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, [selectedProducts]);

  const summarySections: SummarySection[] = useMemo(() => {
    const cabinetConfigs = productConfigs.filter((config) => config.category === "cabinets");

    const cabinetItems =
      cabinetConfigs.length > 0
        ? cabinetConfigs.map((config, index) => {
            const width = typeof config.Width === "number" ? config.Width : undefined;
            const depth = typeof config.Depth === "number" ? config.Depth : undefined;
            const height = typeof config.Height === "number" ? config.Height : undefined;
            const drawers = typeof config.Drawers === "string" ? config.Drawers : "";

            const dims = [width, depth, height].every((v) => v !== undefined) ? `${width}x${depth}x${height}` : "";
            const subtitle = [drawers, dims].filter(Boolean).join(" | ");
            const name =
              typeof config.ProductType === "string"
                ? config.ProductType
                : typeof config.name === "string"
                  ? config.name
                  : undefined;
            const swatchValue =
              typeof config.CabinetColor === "string" && config.CabinetColor ? config.CabinetColor : cabinetColor;
            const swatch = resolveSwatch(swatchValue);

            return {
              id: `cabinet-${index}`,
              title: name ?? "Cabinet",
              subtitle,
              swatch: {
                label: "Cabinet",
                value: swatch.value,
                color: swatch.color,
                image: swatch.image,
              },
              price: "$—",
              copyable: true,
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

              return {
                id: `cabinet-${index}`,
                title: preset.name ?? "Cabinet",
                subtitle,
                swatch: {
                  label: "Cabinet",
                  value: swatch.value,
                  color: swatch.color,
                  image: swatch.image,
                },
                price: "$—",
                copyable: true,
              };
            })
          : [
              {
                id: "cabinet-1",
                title: typeof selectedProductConfig?.name === "string" ? selectedProductConfig.name : "Cabinet",
                subtitle: `${typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : ""} | ${selectedDimensions.width ?? "-"}x${selectedDimensions.depth ?? "-"}x${selectedDimensions.height ?? "-"}`,
                swatch: {
                  ...resolveSwatch(cabinetColor),
                  label: "Cabinet",
                  value: cabinetColor,
                },
                price: "$—",
                copyable: true,
              },
            ];

    const grooveSwatch = resolveSwatch(handleGrooveColor);
    const countertopSwatch = resolveSwatch(countertopColor);

    const cabinetOptionItems: SummaryItem[] = [
      drawerPanelFluting
        ? {
            id: "cabinet-option-drawer-panel",
            title: "Drawer Panel Fluting",
            subtitle: drawerPanelFluting,
            price: "$—",
          }
        : null,
      grainDirection
        ? {
            id: "cabinet-option-grain-direction",
            title: "Grain Direction",
            subtitle: grainDirection,
            price: "$—",
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    const countertopItems: SummaryItem[] = [
      {
        id: "countertop-1",
        title: "Countertop",
        subtitle: countertopThickness ? `${countertopThickness}` : undefined,
        swatch: {
          label: "Countertop",
          value: countertopColor,
          color: countertopSwatch.color,
          image: countertopSwatch.image,
        },
        price: "$—",
      },
      countertopStyle
        ? {
            id: "countertop-style",
            title: "Countertop Style",
            subtitle: countertopStyle,
            price: "$—",
          }
        : null,
    ].filter(Boolean) as SummaryItem[];

    const dividerImage = buildImageSrc(resolveDividerImage(dividerStyle));

    const accessoriesItems: SummaryItem[] = [
      sidePanelsOption
        ? {
            id: "accessories-side-panels",
            title: "Side Panels",
            subtitle: sidePanelsOption,
            price: "$—",
          }
        : null,
      ledOption
        ? {
            id: "accessories-led",
            title: "LED",
            subtitle: ledOption,
            price: "$—",
          }
        : null,
      dividersOption
        ? {
            id: "accessories-dividers",
            title: "Dividers",
            subtitle: dividerStyle || dividersOption,
            swatch:
              dividerStyle && dividerImage
                ? {
                    label: "Divider",
                    value: dividerStyle,
                    color: "#ffffff",
                    image: dividerImage,
                  }
                : undefined,
            price: "$—",
          }
        : null,
      towelBarOption
        ? {
            id: "accessories-towel-bar",
            title: "Towel Bar",
            subtitle: towelBarOption,
            price: "$—",
          }
        : null,
      {
        id: "accessories-1",
        title: "Handle Groove",
        subtitle: "Groove color",
        swatch: {
          label: "Groove",
          value: handleGrooveColor,
          color: grooveSwatch.color,
          image: grooveSwatch.image,
        },
        price: "$—",
      },
    ].filter(Boolean) as SummaryItem[];

    const faucetItems: SummaryItem[] = [
      faucetHolesAmount
        ? {
            id: "faucet-holes-amount",
            title: "Faucet Holes Amount",
            subtitle: faucetHolesAmount,
            price: "$—",
          }
        : null,
      faucetHolesSpacing
        ? {
            id: "faucet-holes-spacing",
            title: "Faucet Holes Spacing",
            subtitle: faucetHolesSpacing,
            price: "$—",
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
            price: "$—",
          },
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
    cabinetColor,
    countertopColor,
    countertopThickness,
    countertopStyle,
    dividersOption,
    drawerPanelFluting,
    faucetHolesAmount,
    faucetHolesSpacing,
    grainDirection,
    handleGrooveColor,
    ledOption,
    materialLookup,
    productsPresets,
    productConfigs,
    selectedDimensions.depth,
    selectedDimensions.height,
    selectedDimensions.width,
    selectedProductConfig,
    sidePanelsOption,
    sinkType,
    towelBarOption,
  ]);

  return (
    <div className={s.summaryPage}>
      {summarySections.map((section) => (
        <div key={section.id} className={s.section}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitle}>{section.title}</div>
          </div>

          <div className={s.sectionList}>
            {section.items.map((item) => {
              const textToCopy = [item.title, item.subtitle, item.swatch?.label, item.swatch?.value]
                .filter(Boolean)
                .join(" - ");

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

                    {item.copyable && (
                      <Hint className={s.copyHint} content={"Copy SKU and descriprion"}>
                        <button
                          className={`${s.copyButton} ${copiedId === item.id ? s.copied : ""}`}
                          onClick={() => handleCopy(textToCopy, item.id)}
                          aria-label="Copy sku and description"
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

                  <div className={s.price}>{item.price}</div>
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
    </div>
  );
};
