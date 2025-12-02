import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";
import s from "./ProductOptionsGrid.module.scss";

interface ProductOptionsGridI {
  data: { id: number; title: string; desc?: string | undefined }[];
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({ data }) => {
  return (
    <div className={s.optionsGrid}>
      {data.map((i) => {
        return <ProductOptionItem key={i.id} id={i.id} title={i.title} desc={i.desc} />;
      })}
    </div>
  );
};
