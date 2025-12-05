import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";
import s from "./ProductOptionsGrid.module.scss";

interface ProductOptionsGridI {
  data: {
    id: number;
    title: string;
    name?: string;
    desc?: string | undefined;
    isAvailable?: boolean;
    isShortDesc: boolean;
  }[];
  handleAdd?: (name: string) => void;
}

export const ProductOptionsGrid: React.FC<ProductOptionsGridI> = ({ data, handleAdd }) => {
  return (
    <>
      {data.length ? (
        <div className={s.optionsGrid}>
          {data.map((i) => {
            return (
              <ProductOptionItem
                key={i.id}
                id={i.id}
                name={i.name}
                title={i.title}
                desc={i.desc}
                isAvailable={i.isAvailable}
                isShortDesc={i.isShortDesc}
                onClick={() => handleAdd(i.name)}
              />
            );
          })}
        </div>
      ) : (
        <div className={s.message}>Select cabinet type first</div>
      )}
    </>
  );
};
