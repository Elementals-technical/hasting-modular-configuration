import { ProductSwatchItem } from "@/shared/ui/ProductSwatchItem/ProductSwatchItem";

import s from "./ProductSwatchesGrid.module.scss";

interface ProductSwatchesGridI {
  data: { id: number; title: string }[];
}

export const ProductSwatchesGrid: React.FC<ProductSwatchesGridI> = ({ data }) => {
  return (
    <div className={s.swatchesGrid}>
      {data.map((i) => {
        console.log(i.title);
        return (
          <>
            <ProductSwatchItem key={i.id} title={i.title} isSwatchWithHint />
          </>
        );
      })}
    </div>
  );
};
