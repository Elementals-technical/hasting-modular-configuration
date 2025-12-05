import s from "./ProductSwatchItem.module.scss";

interface ProductSwatchItemI {
  title: string;
}

export const ProductSwatchItem: React.FC<ProductSwatchItemI> = ({ title }) => {
  return (
    <button className={s.swatchItem}>
      <div className="title">{title}</div>
    </button>
  );
};
