import { useMemo, useState } from "react";

import s from "./SummaryPage.module.scss";

type SummaryItem = {
  id: string;
  title: string;
  subtitle?: string;
  swatch?: {
    label: string;
    value: string;
    color: string;
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

const summarySections: SummarySection[] = [
  {
    id: "cabinet",
    title: "Cabinet",
    copyLabel: "Copy sku and description",
    items: [
      {
        id: "cabinet-1",
        title: "Sink Base 2-Drawer | 60x50x46",
        subtitle: "Central Groove",
        swatch: {
          label: "Colortech",
          value: "Bianco 10B",
          color: "#dcdcd2",
        },
        price: "$199.00",
        copyable: true,
      },
      {
        id: "cabinet-2",
        title: "Sink Base 2-Drawer | 60x50x46",
        subtitle: "Central Groove",
        swatch: {
          label: "Colortech",
          value: "Bianco 10B",
          color: "#dcdcd2",
        },
        price: "$199.00",
      },
    ],
  },
  {
    id: "countertop",
    title: "Countertop",
    items: [
      {
        id: "countertop-1",
        title: "Mineralmarmo",
        subtitle: '"x"',
        swatch: {
          label: "Colortech",
          value: "Grigio fume 10F",
          color: "#4c4543",
        },
        price: "$199.00",
      },
    ],
  },
  {
    id: "basin",
    title: "Basin",
    items: [
      {
        id: "basin-1",
        title: "Vessel",
        subtitle: "Diamond",
        price: "$199.00",
      },
    ],
  },
  {
    id: "accessories",
    title: "Accessories",
    items: [
      {
        id: "accessories-1",
        title: "Side Panels",
        subtitle: "No groove",
        swatch: {
          label: "Colortech",
          value: "Bianco 10B",
          color: "#dcdcd2",
        },
        price: "$199.00",
      },
      {
        id: "accessories-2",
        title: "LED Lights",
        subtitle: "Auto",
        price: "$199.00",
      },
      {
        id: "accessories-3",
        title: "Dividers",
        subtitle: "Bento Grid",
        price: "$199.00",
      },
      {
        id: "accessories-4",
        title: "Towel Bar",
        subtitle: "Left",
        swatch: {
          label: "Colortech",
          value: "Bianco 10B",
          color: "#dcdcd2",
        },
        price: "$199.00",
      },
    ],
  },
];

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

  const copyAll = useMemo(
    () =>
      summarySections
        .map((section) =>
          section.items
            .map((item) => {
              const base = [section.title, item.title, item.subtitle].filter(Boolean).join(" - ");
              const swatch = item.swatch ? ` | ${item.swatch.label} ${item.swatch.value}` : "";
              return `${base}${swatch}`;
            })
            .join("\n"),
        )
        .join("\n\n"),
    [],
  );

  const handleCopy = (text: string, id: string) => {
    if (!navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className={s.summaryPage}>
      {summarySections.map((section) => (
        <div key={section.id} className={s.section}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitle}>{section.title}</div>
            {section.copyLabel && (
              <button className={s.copyPill} onClick={() => handleCopy(copyAll, section.id)}>
                {section.copyLabel}
              </button>
            )}
          </div>

          <div className={s.sectionList}>
            {section.items.map((item) => {
              const textToCopy = [item.title, item.subtitle, item.swatch?.label, item.swatch?.value]
                .filter(Boolean)
                .join(" - ");

              return (
                <div key={item.id} className={`${s.itemRow} ${!item.swatch ? s.noSwatch : ""}`}>
                  <div className={s.itemInfo}>
                    <span className={s.bullet} />

                    <div className={s.itemTexts}>
                      <div className={s.itemTitle}>{item.title}</div>
                      {item.subtitle && <div className={s.itemSubtitle}>{item.subtitle}</div>}
                    </div>

                    {item.copyable && (
                      <button
                        className={`${s.copyButton} ${copiedId === item.id ? s.copied : ""}`}
                        onClick={() => handleCopy(textToCopy, item.id)}
                        aria-label="Copy sku and description"
                      >
                        <span className={s.copyIcon} />
                      </button>
                    )}
                  </div>

                  {item.swatch && (
                    <div className={s.swatch}>
                      <span className={s.swatchColor} style={{ backgroundColor: item.swatch.color }} />
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
          <input type="checkbox" defaultChecked />
          <span className={s.checkboxVisual}>
            <span className={s.plus} />
          </span>
          <span className={s.addLabel}>Add free swatches</span>
        </label>

        <div className={s.swatchesListHeader}>Swatches list</div>

        <div className={s.swatchesList}>
          {swatches.map((swatch) => (
            <div key={swatch.id} className={s.swatchTile}>
              <span className={s.tileColor} style={{ backgroundColor: swatch.color }} />
              <span className={s.tileLabel}>{swatch.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
