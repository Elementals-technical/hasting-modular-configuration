import { useState } from "react";

import { ProductSwatchItem } from "@/shared/ui/ProductSwatchItem/ProductSwatchItem";

import s from "./ProductSwatchesGrid.module.scss";

interface ProductSwatchesGridI {
  data: { id: number; title: string }[];
  isLedSection?: boolean;
  onSelectChange?: (title: string | null) => void;
}

export const ProductSwatchesGrid: React.FC<ProductSwatchesGridI> = ({ data, isLedSection, onSelectChange }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const showExtras = (isLedSection && selected === "Auto Fill") || (isLedSection && selected === "Customize");

  return (
    <div className={s.wrapper}>
      <div className={s.swatchesGrid}>
        {data.map((i) => (
          <ProductSwatchItem
            key={i.id}
            title={i.title}
            isSwatchWithHint
            isActive={selected === i.title}
            onSelect={() => {
              setSelected(i.title);
              onSelectChange?.(i.title);
            }}
          />
        ))}
      </div>

      {showExtras && (
        <div className={s.extraBlock}>
          <label className={s.checkbox}>
            <input type="checkbox" checked={selected === "Auto Fill"} />
            <span>Apply to all</span>
          </label>
          <p className={s.helper}>We’ll outfit all your drawer cabinets with factory-installed LEDs</p>
        </div>
      )}
    </div>
  );
};
