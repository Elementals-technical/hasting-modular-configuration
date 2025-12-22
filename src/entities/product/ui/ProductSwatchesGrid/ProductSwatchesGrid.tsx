import { useEffect, useState } from "react";

import { ProductSwatchItem } from "@/shared/ui/ProductSwatchItem/ProductSwatchItem";

import s from "./ProductSwatchesGrid.module.scss";

interface ProductSwatchesGridI {
  data: { id: number; title: string; value?: string; isSwatchWithHint: boolean }[];
  isLedSection?: boolean;
  onSelectChange?: (title: string | null) => void;
  selectedValue?: string | null;
}

export const ProductSwatchesGrid: React.FC<ProductSwatchesGridI> = ({
  data,
  isLedSection,
  onSelectChange,
  selectedValue,
}) => {
  const [selected, setSelected] = useState<string | null>(selectedValue ?? null);

  useEffect(() => {
    if (selectedValue === undefined) return;

    setSelected(selectedValue);
  }, [selectedValue]);

  const showExtras = (isLedSection && selected === "Auto Fill") || (isLedSection && selected === "Customize");

  return (
    <div className={s.wrapper}>
      <div className={s.swatchesGrid}>
        {data.map((i) => {
          const swatchValue = i.value ?? i.title;

          return (
            <ProductSwatchItem
              key={i.id}
              title={i.title}
              isSwatchWithHint={i.isSwatchWithHint}
              isActive={selected === swatchValue}
              onSelect={() => {
                setSelected(swatchValue);
                onSelectChange?.(swatchValue);
              }}
            />
          );
        })}
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
