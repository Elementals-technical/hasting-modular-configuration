import { ProductModelItem } from "@/shared/ui/ProductModelItem/ProductModelItem";

import temp_img from "@/shared/assets/images/png/Image.png";
import { type ProductModel, type PresetProduct } from "@/entities/product/types";

import s from "./ProductModelsGrid.module.scss";

export const productMockData: ProductModel[] = [
  {
    id: 1,
    img: temp_img,
    title: 'Urban Standard · 24" 1-Drawer',
    // desc: "60W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 2,
    img: temp_img,
    title: 'Urban Standard · 24" 2-Drawer',
    // desc: "60W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 3,
    img: temp_img,
    title: 'Urban Standard · 28" 1-Drawer',
    // desc: "70W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 4,
    img: temp_img,
    title: 'Urban Standard · 28" 2-Drawer',
    // desc: "70W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 5,
    img: temp_img,
    title: 'Urban Standard · 32" 1-Drawer',
    // desc: "80W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 6,
    img: temp_img,
    title: 'Urban Standard · 32" 2-Drawer',
    // desc: "80W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 7,
    img: temp_img,
    title: 'Urban Standard · 34" 1-Drawer',
    // desc: "Sink Base 60 + Side Cabinet 25 · 85W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 25, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 8,
    img: temp_img,
    title: 'Urban Standard · 34" 2-Drawer',
    // desc: "Side Cabinet 25 + Sink Base 60 · 85W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 25, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 9,
    img: temp_img,
    title: 'Urban Standard · 36" 1-Drawer',
    // desc: "90W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 10,
    img: temp_img,
    title: 'Urban Standard · 36" 2-Drawer',
    // desc: "90W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [{ name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" }],
  },
  {
    id: 11,
    img: temp_img,
    title: 'Urban Standard · 42" 1-Drawer',
    // desc: "105W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 12,
    img: temp_img,
    title: 'Urban Standard · 42" 2-Drawer',
    // desc: "105W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 13,
    img: temp_img,
    title: 'Urban Standard · 42" 1-Drawer',
    // desc: "Sink Base 70 + Side Cabinet 35 · 105W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 14,
    img: temp_img,
    title: 'Urban Standard · 42" 2-Drawer',
    // desc: "Sink Base 70 + Side Cabinet 35 · 105W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 15,
    img: temp_img,
    title: 'Urban Standard · 46" 1-Drawer',
    // desc: "Sink Base 80 + Side Cabinet 35 · 115W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 16,
    img: temp_img,
    title: 'Urban Standard · 46" 2-Drawer',
    // desc: "Sink Base 80 + Side Cabinet 35 · 115W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 17,
    img: temp_img,
    title: 'Urban Standard · 48" 1-Drawer',
    // desc: "Sink Base 70 + Side Cabinet 50 · 120W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 18,
    img: temp_img,
    title: 'Urban Standard · 48" 2-Drawer',
    // desc: "Sink Base 70 + Side Cabinet 50 · 120W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 19,
    img: temp_img,
    title: 'Urban Standard · 48" 1-Drawer',
    // desc: "Sink Base 60 + Sink Base 60 · 120W × 51D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 20,
    img: temp_img,
    title: 'Urban Standard · 48" 2-Drawer',
    // desc: "Sink Base 60 + Sink Base 60 · 120W × 51D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 21,
    img: temp_img,
    title: 'Urban Standard · 55" 2-Drawer',
    // desc: "Sink Base 70 (2-Drawer) + Open Shelf 35 + Side Cabinet 35 (2-Drawer) · 140W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 56 },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 22,
    img: temp_img,
    title: 'Urban Standard · 57" 2-Drawer',
    // desc: "Open Shelf 35 + Side Cabinet 50 (2-Drawer) + Sink Base 60 (2-Drawer) · 145W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 56 },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 23,
    img: temp_img,
    title: 'Urban Standard · 59" 1-Drawer',
    // desc: "Side Cabinet 70 (1-Drawer) + Sink Base 80 (1-Drawer) · 150W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 24,
    img: temp_img,
    title: 'Urban Standard · 59" 2-Drawer',
    // desc: "Sink Base 90 (2-Drawer) + Side Cabinet 60 (2-Drawer) · 150W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 25,
    img: temp_img,
    title: 'Urban Standard · 59" 2-Drawer',
    // desc: "Sink Base 70 (2-Drawer) + Side Cabinet 80 (2-Drawer) · 150W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 26,
    img: temp_img,
    title: 'Urban Standard · 63" 1-Drawer',
    // desc: "Sink Base 90 (1-Drawer) + Open Shelf 35 + Side Cabinet 35 (1-Drawer) · 160W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 53 },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 27,
    img: temp_img,
    title: 'Urban Standard · 63" 1-Drawer',
    // desc: "Side Cabinet 35 (1-Drawer) + Sink Base 90 (1-Drawer) + Side Cabinet 35 (1-Drawer) · 160W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 28,
    img: temp_img,
    title: 'Urban Standard · 63" 1-Drawer',
    // desc: "Sink Base 80 (1-Drawer) + Side Cabinet 80 (1-Drawer) · 160W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 29,
    img: temp_img,
    title: 'Urban Standard · 63" 2-Drawer',
    // desc: "Sink Base 80 (2-Drawer) + Sink Base 80 (2-Drawer) · 160W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 30,
    img: temp_img,
    title: 'Urban Standard · 65" 2-Drawer',
    // desc: "Side Cabinet 60 (2-Drawer) + Sink Base 105 (2-Drawer) · 165W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 31,
    img: temp_img,
    title: 'Urban Standard · 67" 2-Drawer',
    // desc: "Side Cabinet 50 (2-Drawer) + Sink Base 70 (2-Drawer) + Open Shelf 50 · 170W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 50, Depth: 50.5, Height: 56 },
    ],
  },
  {
    id: 32,
    img: temp_img,
    title: 'Urban Standard · 69" 2-Drawer',
    // desc: "Sink Base 105 (2-Drawer) + Side Cabinet 70 (2-Drawer) · 175W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 33,
    img: temp_img,
    title: 'Urban Standard · 69" 2-Drawer',
    // desc: "Sink Base 80 (2-Drawer) + Side Cabinet 60 (2-Drawer) + Side Cabinet 35 (2-Drawer) · 175W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 34,
    img: temp_img,
    title: 'Urban Standard · 71" 2-Drawer',
    // desc: "Sink Base 90 (2-Drawer) + Sink Base 90 (2-Drawer) · 180W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 35,
    img: temp_img,
    title: 'Urban Standard · 73" 1-Drawer',
    // desc: "Side Cabinet 60 (1-Drawer) + Open Shelf 35 + Sink Base 90 (1-Drawer) · 185W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 53 },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 36,
    img: temp_img,
    title: 'Urban Standard · 73" 2-Drawer',
    // desc: "Sink Base 90 (2-Drawer) + Side Cabinet 60 (2-Drawer) + Side Cabinet 35 (2-Drawer) · 185W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 37,
    img: temp_img,
    title: 'Urban Standard · 75" 2-Drawer',
    // desc: "Sink Base 120 (2-Drawer) + Side Cabinet 70 (2-Drawer) · 190W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 120, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 38,
    img: temp_img,
    title: 'Urban Standard · 75" 2-Drawer',
    // desc: "Side Cabinet 50 (2-Drawer) + Sink Base 90 (2-Drawer) + Side Cabinet 50 (2-Drawer) · 190W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 39,
    img: temp_img,
    title: 'Urban Standard · 75" 2-Drawer',
    // desc: "Sink Base 105 (2-Drawer) + Side Cabinet 50 (2-Drawer) + Open Shelf 35 · 190W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 56 },
    ],
  },
  {
    id: 40,
    img: temp_img,
    title: 'Urban Standard · 79" 1-Drawer',
    // desc: "Sink Base 70 (1-Drawer) + Side Cabinet 60 (1-Drawer) + Sink Base 70 (1-Drawer) · 200W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 41,
    img: temp_img,
    title: 'Urban Standard · 83" 1-Drawer',
    // desc: "Sink Base 90 (1-Drawer) + Side Cabinet 60 (1-Drawer) + Side Cabinet 60 (1-Drawer) · 210W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 42,
    img: temp_img,
    title: 'Urban Standard · 83" 2-Drawer',
    // desc: "Sink Base 70 (2-Drawer) + Side Cabinet 70 (2-Drawer) + Sink Base 70 (2-Drawer) · 210W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 43,
    img: temp_img,
    title: 'Urban Standard · 83" 2-Drawer',
    // desc: "Sink Base 105 (2-Drawer) + Sink Base 105 (2-Drawer) · 210W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 44,
    img: temp_img,
    title: 'Urban Standard · 83" 2-Drawer',
    // desc: "Sink Base 80 (2-Drawer) + Side Cabinet 50 (2-Drawer) + Sink Base 80 (2-Drawer) · 210W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 45,
    img: temp_img,
    title: 'Urban Standard · 87" 1-Drawer',
    // desc: "Sink Base 80 (1-Drawer) + Open Shelf 60 + Sink Base 80 (1-Drawer) · 220W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 60, Depth: 50.5, Height: 53 },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 46,
    img: temp_img,
    title: 'Urban Standard · 89" 2-Drawer',
    // desc: "Side Cabinet 105 (2-Drawer) + Sink Base 120 (2-Drawer) · 225W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 120, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 47,
    img: temp_img,
    title: 'Urban Standard · 89" 2-Drawer',
    // desc: "Side Cabinet 60 (2-Drawer) + Sink Base 105 (2-Drawer) + Side Cabinet 60 (2-Drawer) · 225W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 48,
    img: temp_img,
    title: 'Urban Standard · 93" 2-Drawer',
    // desc: "Side Cabinet 80 (2-Drawer) + Side Cabinet 50 (2-Drawer) + Sink Base 105 (2-Drawer) · 235W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 49,
    img: temp_img,
    title: 'Urban Standard · 95" 1-Drawer',
    // desc: "Sink Base 90 (1-Drawer) + Side Cabinet 60 (1-Drawer) + Sink Base 90 (1-Drawer) · 240W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 90, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 50,
    img: temp_img,
    title: 'Urban Standard · 95" 1-Drawer',
    // desc: "Sink Base 80 (1-Drawer) + Side Cabinet 80 (1-Drawer) + Sink Base 80 (1-Drawer) · 240W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 51,
    img: temp_img,
    title: 'Urban Standard · 95" 2-Drawer',
    // desc: "Sink Base 120 (2-Drawer) + Sink Base 120 (2-Drawer) · 240W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 120, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 120, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
  {
    id: 52,
    img: temp_img,
    title: 'Urban Standard · 95" 2-Drawer',
    // desc: "Side Cabinet 60 (2-Drawer) + Sink Base 120 (2-Drawer) + Side Cabinet 60 (2-Drawer) · 240W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 120, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 60, Depth: 50.5, Height: 56, Drawers: "2D" },
    ],
  },
  {
    id: 53,
    img: temp_img,
    title: 'Urban Standard · 97" 1-Drawer',
    // desc: "Side Cabinet 70 (1-Drawer) + Sink Base 105 (1-Drawer) + Open Shelf 35 + Side Cabinet 35 (1-Drawer) · 245W × 50.5D × 53H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 70, Depth: 50.5, Height: 53, Drawers: "1D" },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 105, Depth: 50.5, Height: 53, Drawers: "1D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 35, Depth: 50.5, Height: 53 },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 35, Depth: 50.5, Height: 53, Drawers: "1D" },
    ],
  },
  {
    id: 54,
    img: temp_img,
    title: 'Urban Standard · 103" 2-Drawer',
    // desc: "Sink Base 80 (2-Drawer) + Open Shelf 25 + Side Cabinet 50 (2-Drawer) + Open Shelf 25 + Sink Base 80 (2-Drawer) · 260W × 50.5D × 56H cm",
    isProductModel: true,
    // price: "Price on request",
    presetProducts: [
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 25, Depth: 50.5, Height: 56 },
      { name: "Sink-Cabinet", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 50, Depth: 50.5, Height: 56, Drawers: "2D" },
      { name: "Open-Shelf", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Width: 25, Depth: 50.5, Height: 56 },
      { name: "Sink-Base", CabinetColor:"Pulpis Chiaro TKH", CountertopColor:"Pietra Di Savoia Antracite TQ6", Handle: 'handle_urban_topcut', Width: 80, Depth: 50.5, Height: 56, Drawers: "2D", sinkType: "Top_HPLPrisma" },
    ],
  },
];

interface ProductModelsGridI {
  createModelBtn?: React.ReactNode;
  handleAddPreset: (presetProducts?: PresetProduct[]) => void;
  handleCustomizePreset: (presetProducts?: PresetProduct[]) => void;
  activePresetId?: number | null;
}

export const ProductModelsGrid: React.FC<ProductModelsGridI> = ({
  createModelBtn,
  handleAddPreset,
  handleCustomizePreset,
  activePresetId,
}) => {
  return (
    <div className={s.optionsGridWrapper}>
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
              onSelect={handleAddPreset}
              onCustomize={handleCustomizePreset}
              isActive={activePresetId === i.id}
            />
          );
        })}
      </div>
    </div>
  );
};
