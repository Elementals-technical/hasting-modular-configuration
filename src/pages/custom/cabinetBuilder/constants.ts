import sinkBaseImage from "@/shared/assets/images/png/sink_base.png";
import sinkCabinetImage from "@/shared/assets/images/png/sink_cabinet.png";
import openShelfImage from "@/shared/assets/images/png/open_shelf.png";
import sideShelfImage from "@/shared/assets/images/png/side_shelf.png";
import oneDrawerImage from "@/shared/assets/images/png/1_drawer.png";
import twoDrawerImage from "@/shared/assets/images/png/2_drawer.png";

export const cabinetTypeMetadataByCode: Record<
  string,
  { title?: string; desc?: string; isShortDesc?: boolean; image?: string }
> = {
  "Sink-Base": {
    title: "Sink Base",
    desc: "Cabinet with a basin",
    isShortDesc: false,
    image: sinkBaseImage,
  },
  "Sink-Cabinet": {
    title: "Side Cabinet",
    desc: "Cabinet without a basin",
    isShortDesc: false,
    image: sinkCabinetImage,
  },
  "Open-Shelf": {
    title: "Open Shelf",
    isShortDesc: false,
    image: openShelfImage,
  },
  "Side-Cabinet": {
    title: "Side Cabinet",
    isShortDesc: false,
    image: sideShelfImage,
  },
  "Side-Shelf": {
    title: "Side Shelf",
    isShortDesc: false,
    image: sideShelfImage,
  },
};

export const optionsMockData = [
  {
    id: 101,
    title: "Sink-Base",
    name: "Sink-Base",
    desc: "Cabinet with a basin",
    isShortDesc: false,
    metadata: {
      image: sinkBaseImage,
    },
    config: {
      Height: 56,
      Depth: 46,
      Width: 60,
      CabinetColor: "Pulpis Chiaro TKH",
      sinkType: "Top_Tekorlux_Rectangular",
      HandleGrooveColor: "Pulpis Chiaro TKH",
      CountertopColor: "Cacao Orinoco FF MT",
    },
  },
  {
    id: 102,
    title: "Sink Cabinet",
    name: "Sink-Cabinet",
    desc: "Cabinet without a basin",
    isShortDesc: false,
    metadata: {
      image: sinkCabinetImage,
    },
    config: {
      Height: 53,
      Depth: 46,
      CabinetColor: "Pulpis Chiaro TKH",
      Width: 60,
    },
  },
  {
    id: 103,
    title: "Open Shelf",
    name: "Open-Shelf",
    isShortDesc: false,
    metadata: {
      image: openShelfImage,
    },
    config: {
      Height: 56,
      Depth: 46,
      CabinetColor: "Pulpis Chiaro TKH",
      Width: 60,
    },
  },
  {
    id: 104,
    title: "Side Shelf",
    name: "Side-Shelf",
    isShortDesc: false,
    metadata: {
      image: sideShelfImage,
    },
    config: {
      Height: 56,
      Depth: 46,
      CabinetColor: "Pulpis Chiaro TKH",
      Width: 60,
    },
  },
];

export const drawerMetaByValue: Record<
  string,
  {
    title: string;
    id: number;
    metadata?: { image?: string };
    isShortDesc?: boolean;
  }
> = {
  "1": {
    id: 201,
    title: "1 Drawer",
    metadata: { image: oneDrawerImage },
    isShortDesc: false,
  },
  "2": {
    id: 202,
    title: "2 Drawer",
    metadata: { image: twoDrawerImage },
    isShortDesc: false,
  },
  "1+inner": {
    id: 203,
    title: "1 Drawer With Inner Drawer",
    isShortDesc: false,
  },
};
