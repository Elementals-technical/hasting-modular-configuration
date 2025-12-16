import { ProductModelItem } from "@/shared/ui/ProductModelItem/ProductModelItem";

import temp_img from "@/shared/assets/images/png/Image.png";
import { type ProductModel, type PresetProduct } from "@/entities/product/types";

import s from "./ProductModelsGrid.module.scss";

export const productMockData: ProductModel[] = [
  {
    id: 1,
    img: temp_img,
    title: 'Urban Standard · 24" 1-Drawer',
    desc: "60W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 60, Depth: 51, Height: 53 }],
  },
  {
    id: 2,
    img: temp_img,
    title: 'Urban Standard · 24" 2-Drawer',
    desc: "60W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 60, Depth: 51, Height: 56 }],
  },
  {
    id: 3,
    img: temp_img,
    title: 'Urban Standard · 28" 1-Drawer',
    desc: "70W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 70, Depth: 51, Height: 53 }],
  },
  {
    id: 4,
    img: temp_img,
    title: 'Urban Standard · 28" 2-Drawer',
    desc: "70W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 70, Depth: 51, Height: 56 }],
  },
  {
    id: 5,
    img: temp_img,
    title: 'Urban Standard · 32" 1-Drawer',
    desc: "80W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 80, Depth: 51, Height: 53 }],
  },
  {
    id: 6,
    img: temp_img,
    title: 'Urban Standard · 32" 2-Drawer',
    desc: "80W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 80, Depth: 51, Height: 56 }],
  },
  {
    id: 7,
    img: temp_img,
    title: 'Urban Standard · 34" 1-Drawer',
    desc: "Sink Base 60 + Side Cabinet 25 · 85W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 53 },
      { name: "Sink-Cabinet", Width: 25, Depth: 51, Height: 53 },
    ],
  },
  {
    id: 8,
    img: temp_img,
    title: 'Urban Standard · 34" 2-Drawer',
    desc: "Side Cabinet 25 + Sink Base 60 · 85W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", Width: 25, Depth: 51, Height: 56 },
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 56 },
    ],
  },
  {
    id: 9,
    img: temp_img,
    title: 'Urban Standard · 36" 1-Drawer',
    desc: "90W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 90, Depth: 51, Height: 53 }],
  },
  {
    id: 10,
    img: temp_img,
    title: 'Urban Standard · 36" 2-Drawer',
    desc: "90W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 90, Depth: 51, Height: 56 }],
  },
  {
    id: 11,
    img: temp_img,
    title: 'Urban Standard · 42" 1-Drawer Sink Base',
    desc: "105W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 105, Depth: 51, Height: 53 }],
  },
  {
    id: 12,
    img: temp_img,
    title: 'Urban Standard · 42" 2-Drawer Sink Base',
    desc: "105W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [{ name: "Sink-Base", Width: 105, Depth: 51, Height: 56 }],
  },
  {
    id: 13,
    img: temp_img,
    title: 'Urban Standard · 42" 1-Drawer + Side Cabinet',
    desc: "Sink Base 70 + Side Cabinet 35 · 105W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 70, Depth: 51, Height: 53 },
      { name: "Sink-Cabinet", Width: 35, Depth: 51, Height: 53 },
    ],
  },
  {
    id: 14,
    img: temp_img,
    title: 'Urban Standard · 42" 2-Drawer + Side Cabinet',
    desc: "Sink Base 70 + Side Cabinet 35 · 105W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 70, Depth: 51, Height: 56 },
      { name: "Sink-Cabinet", Width: 35, Depth: 51, Height: 56 },
    ],
  },
  {
    id: 15,
    img: temp_img,
    title: 'Urban Standard · 46" 1-Drawer + Side Cabinet',
    desc: "Sink Base 80 + Side Cabinet 35 · 115W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 80, Depth: 51, Height: 53 },
      { name: "Sink-Cabinet", Width: 35, Depth: 51, Height: 53 },
    ],
  },
  {
    id: 16,
    img: temp_img,
    title: 'Urban Standard · 46" 2-Drawer + Side Cabinet',
    desc: "Sink Base 80 + Side Cabinet 35 · 115W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 80, Depth: 51, Height: 56 },
      { name: "Sink-Cabinet", Width: 35, Depth: 51, Height: 56 },
    ],
  },
  {
    id: 17,
    img: temp_img,
    title: 'Urban Standard · 48" 1-Drawer + Side Cabinet',
    desc: "Sink Base 70 + Side Cabinet 50 · 120W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 70, Depth: 51, Height: 53 },
      { name: "Sink-Cabinet", Width: 50, Depth: 51, Height: 53 },
    ],
  },
  {
    id: 18,
    img: temp_img,
    title: 'Urban Standard · 48" 2-Drawer + Side Cabinet',
    desc: "Sink Base 70 + Side Cabinet 50 · 120W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 70, Depth: 51, Height: 56 },
      { name: "Sink-Cabinet", Width: 50, Depth: 51, Height: 56 },
    ],
  },
  {
    id: 19,
    img: temp_img,
    title: 'Urban Standard · 48" 1-Drawer Double Sink Base',
    desc: "Sink Base 60 + Sink Base 60 · 120W × 51D × 53H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 53 },
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 53 },
    ],
  },
  {
    id: 20,
    img: temp_img,
    title: 'Urban Standard · 48" 2-Drawer Double Sink Base',
    desc: "Sink Base 60 + Sink Base 60 · 120W × 51D × 56H cm",
    isProductModel: true,
    price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 56 },
      { name: "Sink-Base", Width: 60, Depth: 51, Height: 56 },
    ],
  },
];

interface ProductModelsGridI {
  createModelBtn?: React.ReactNode;
  handleAddPreset: (presetProducts?: PresetProduct[]) => void;
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
