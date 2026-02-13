import flutingVerticalA from "@/shared/assets/images/png/flutting/Fluting_Vertical_TypeA.png";
import flutingVerticalB from "@/shared/assets/images/png/flutting/Fluting_Vertical_TypeB.png";
import flutingHorizontalA from "@/shared/assets/images/png/flutting/Fluting_Horizontal_TypeA.png";
import flutingHorizontalB from "@/shared/assets/images/png/flutting/Fluting_Horizontal_TypeB.png";
import grainHorizontal from "@/shared/assets/images/png/gain_direction/Grain_Horizontal.png";
import grainVertical from "@/shared/assets/images/png/gain_direction/Grain_Vertical.png";

export const optionsMockData = [
  {
    id: 1001,
    title: "Arancio Zucca 09 MT",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 1002,
    title: "Ardesia DD GL",
    desc: "Grigio fume 10FF",
    isShortDesc: false,
  },
];

export const optionsMockData2 = [
  {
    id: 2001,
    title: "None",
    desc: "Keep same color as cabinet",
    isShortDesc: false,
  },
  {
    id: 2002,
    title: "Colortech 10B",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 2003,
    title: "Colortech 10F",
    desc: "Grigio fume 10F",
    isShortDesc: false,
  },
  {
    id: 2004,
    title: "Cemento 1a",
    desc: "Centre 1A1",
    isShortDesc: false,
  },
  {
    id: 2005,
    title: "Cemento 1a2",
    desc: "Tortora 1A2",
    isShortDesc: false,
  },
  {
    id: 2006,
    title: "Colortech 10BB",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
];

export const optionsMockData3 = [
  {
    id: 3001,
    title: "None",
    isShortDesc: false,
    metadata: { value: "None" },
  },
  {
    id: 3002,
    title: "Fluting Vertical A",
    isShortDesc: false,
    metadata: { value: "FlutingVerticalA", image: flutingVerticalA },
  },
  {
    id: 3003,
    title: "Fluting Vertical B",
    isShortDesc: false,
    metadata: { value: "FlutingVerticalB", image: flutingVerticalB },
  },
  {
    id: 3004,
    title: "Fluting Horizontal A",
    isShortDesc: false,
    metadata: { value: "FlutingHorizontalA", image: flutingHorizontalA },
  },
  {
    id: 3005,
    title: "Fluting Horizontal B",
    isShortDesc: false,
    metadata: { value: "FlutingHorizontalB", image: flutingHorizontalB },
  },
];

export const optionsMockData4 = [
  {
    id: 4001,
    title: "Horizontal",
    isShortDesc: false,
    metadata: { value: "GrainHorizontal", image: grainHorizontal },
  },
  {
    id: 4002,
    title: "Vertical",
    isShortDesc: false,
    metadata: { value: "GrainVertical", image: grainVertical },
  },
];
