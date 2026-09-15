import { ProductModelItem } from "@/shared/ui/ProductModelItem/ProductModelItem";

import { type ProductModel, type PresetProduct } from "@/entities/product/types";

import s from "./ProductModelsGrid.module.scss";

interface ProductModelsGridI {
  data: ProductModel[];
  createModelBtn?: React.ReactNode;
  handleAddPreset: (presetProducts?: PresetProduct[], presetId?: number) => void;
  handleCustomizePreset: (presetProducts?: PresetProduct[]) => void;
  activePresetId?: number | null;
}

export const ProductModelsGrid: React.FC<ProductModelsGridI> = ({
  data,
  createModelBtn,
  handleAddPreset,
  handleCustomizePreset,
  activePresetId,
}) => {
  return (
    <div className={s.optionsGridWrapper}>
      <div className={s.optionsGrid}>
        {createModelBtn}

        {data.map((preset) => {
          return (
            <ProductModelItem
              key={preset.id}
              id={preset.id}
              title={preset.title}
              img={preset.img}
              desc={preset.desc}
              price={preset.price}
              isProductModel={true}
              presetProducts={preset.presetProducts}
              onSelect={handleAddPreset}
              onCustomize={handleCustomizePreset}
              isActive={activePresetId === preset.id}
            />
          );
        })}
      </div>
    </div>
  );
};
