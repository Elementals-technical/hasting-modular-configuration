import { ProductModelItem } from "@/shared/ui/ProductModelItem/ProductModelItem";

import temp_img from "@/shared/assets/images/png/Image.png";

import s from "./ProductModelsGrid.module.scss";

export const productMockData = [
  {
    id: 1,
    img: temp_img,
    title: "CabinetUniBox",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
    presetProducts: [
      { name: "Sink-Base", Height: 56, Depth: 50.5, CabinetColor: "Ardesia DD GL", Width: 120 },
      { name: "Sink-Base", Height: 56, CabinetColor: "Ardesia DD GL", Depth: 50.5, Width: 60 },
      { name: "Sink-Base", Height: 56, CabinetColor: "Ardesia DD GL", Depth: 50.5, Width: 90 },
    ],
  },
  {
    id: 2,
    img: temp_img,
    title: "UniOpenShelves",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
    presetProducts: [
      { name: "Sink-Base", Width: 60 },
      { name: "UniOpenShelves", Width: 90 },
      { name: "Sink-Base", Width: 120 },
    ],
  },
  {
    id: 3,
    img: temp_img,
    title: "UniOpenShelves",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
    presetProducts: [
      { name: "Open-Shelf", Width: 60 },
      { name: "Open-Shelf", Width: 60 },
      { name: "Sink-Base", Width: 60 },
      { name: "Sink-Base", Width: 60 },

      { name: "Open-Shelf" },
    ],
  },
  {
    id: 4,
    img: temp_img,
    title: "UniOpenShelves",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
    presetProducts: [{ name: "Open-Shelf" }, { name: "Open-Shelf" }],
  },
  {
    id: 5,
    img: temp_img,
    title: "CabinetUniBox",
    desc: "57'' 2-Drawer",
    isProductModel: true,
    price: "$1,299.99",
    presetProducts: [
      { name: "Sink-Base", Width: 120 },
      { name: "Sink-Base" },
      { name: "Sink-Base" },
      { name: "Sink-Base", Width: 120 },
    ],
  },
];

interface ProductModelsGridI {
  createModelBtn?: React.ReactNode;
  handleAddPreset: (presetProducts: any) => void;
}

export const ProductModelsGrid: React.FC<ProductModelsGridI> = ({ createModelBtn, handleAddPreset }) => {
  return (
    <div className={s.optionsGrid}>
      {createModelBtn}

      {productMockData.map((i) => {
        return (
          <ProductModelItem
            key={i.id}
            id={i.id}
            title={i.title}
            img={i.img}
            desc={i.desc}
            price={i.price}
            isProductModel={true}
            presetProducts={i.presetProducts}
            onClick={handleAddPreset}
          />
        );
      })}
    </div>
  );
};
