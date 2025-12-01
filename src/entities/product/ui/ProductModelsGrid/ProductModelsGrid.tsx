import { ProductModelItem } from "@/shared/ui/ProductModelItem/ProductModelItem";

import temp_img from "@/shared/assets/images/png/Image.png";

import s from "./ProductModelsGrid.module.scss";

const productMockData = [
  {
    id: 1,
    img: temp_img,
    title: "Urban Standard ",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
  },
  {
    id: 2,
    img: temp_img,
    title: "Urban Standard ",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
  },
  {
    id: 3,
    img: temp_img,
    title: "Urban Standard ",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
  },
  {
    id: 4,
    img: temp_img,
    title: "Urban Standard ",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
  },
  {
    id: 5,
    img: temp_img,
    title: "Urban Standard ",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
  },
];

interface ProductModelsGridI {
  createModelBtn?: React.ReactNode;
}

export const ProductModelsGrid: React.FC<ProductModelsGridI> = ({ createModelBtn }) => {
  return (
    <div className={s.optionsGrid}>
      {createModelBtn}

      {productMockData.map((i) => {
        return (
          <ProductModelItem id={i.id} title={i.title} img={i.img} desc={i.desc} price={i.price} isProductModel={true} />
        );
      })}
    </div>
  );
};
