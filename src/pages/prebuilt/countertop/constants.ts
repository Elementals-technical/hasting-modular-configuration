import prismaImage from "@/shared/assets/images/jpeg/prisma.jpg";
import quadraImage from "@/shared/assets/images/jpeg/quadro.jpg";
import coverImage from "@/shared/assets/images/jpeg/cover.jpg";
import stripImage from "@/shared/assets/images/jpeg/strip.jpg";
import integratedImage from "@/shared/assets/images/png/integrated.png";
import vesselImage from "@/shared/assets/images/png/vessel.png";
import undermountImage from "@/shared/assets/images/png/undermount.png";

export const optionsMockData = [
  {
    id: 1,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Colortech",
    desc: "Grigio fume 10F",
    isShortDesc: false,
  },
  {
    id: 3,
    title: "Cemento",
    desc: "Centre 1A1",
    isShortDesc: false,
  },
  {
    id: 4,
    title: "Cemento",
    desc: "Tortora 1A2",
    isShortDesc: false,
  },
  {
    id: 5,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 7,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 8,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 9,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
];

export const optionsMockData4 = [
  {
    id: 10,
    title: "⅜”",
    value: "0.375",
    isShortDesc: false,
    isSwatchWithHint: true,
  },
  {
    id: 11,
    title: "½”",
    value: "0.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 12,
    title: "2⅜”",
    value: "2.375",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 13,
    title: "4”",
    value: "4",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 14,
    title: "5⅛”",
    value: "5.125",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 15,
    title: "5½”",
    value: "5.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
];

export const optionsMockData2 = [
  {
    id: 1,
    title: "Integrated",
    isAvailable: false,
    isShortDesc: false,
    metadata: {
      image: integratedImage,
    },
  },
  {
    id: 2,
    title: "Vessel",
    isAvailable: true,
    isShortDesc: false,
    metadata: {
      image: vesselImage,
    },
  },
  {
    id: 3,
    title: "Undermount",
    isAvailable: false,
    isShortDesc: false,
    metadata: {
      image: undermountImage,
    },
  },
];

export const optionsMockData3 = [
  {
    id: 3001,
    title: "Prisma",
    name: "Top_HPLPrisma",
    isShortDesc: true,
    metadata: {
      image: prismaImage,
    },
  },
  {
    id: 3002,
    title: "Quadra",
    name: "Top_HPLQuadra",
    isShortDesc: false,
    metadata: {
      image: quadraImage,
    },
  },
  {
    id: 3003,
    title: "Cover",
    name: "Top_HPLCover",
    isShortDesc: false,
    metadata: {
      image: coverImage,
    },
  },
  {
    id: 3004,
    title: "Strip",
    name: "Top_HPLStrip",
    isShortDesc: false,
    metadata: {
      image: stripImage,
    },
  },
  {
    id: 3005,
    title: "HPL/Fenix Cover Gres",
    name: "Top_HPL/Fenix_Cover_Gres",
    isShortDesc: false,
  },
  {
    id: 3006,
    title: "HPL/Fenix Prisma Gres",
    name: "Top_HPL/Fenix_Prisma_Gres",
    isShortDesc: false,
  },
  {
    id: 3007,
    title: "HPL/Fenix Quadra Gres",
    name: "Top_HPL/Fenix_Quadra_Gres",
    isShortDesc: false,
  },
  {
    id: 3008,
    title: "HPL/Fenix Strip Gres",
    name: "Top_HPL/Fenix_Strip_Gres",
    isShortDesc: false,
  },
  {
    id: 3009,
    title: "Glass Ovale",
    name: "Top_Glass_Ovale",
    isShortDesc: false,
  },
  {
    id: 3010,
    title: "Mineralmarmo Diamond",
    name: "Top_Mineralmarmo_Diamond",
    isShortDesc: false,
  },
  {
    id: 3011,
    title: "Ocritech Oly55",
    name: "Top_Ocritech_Oly55",
    isShortDesc: false,
  },
  {
    id: 3012,
    title: "Ocritech Oly56",
    name: "Top_Ocritech_Oly56",
    isShortDesc: false,
  },
  {
    id: 3013,
    title: "Ocritech Orion",
    name: "Top_Ocritech_Orion",
    isShortDesc: false,
  },
  {
    id: 3014,
    title: "Ocritech Quadra",
    name: "Top_Ocritech_Quadra",
    isShortDesc: false,
  },
  {
    id: 3015,
    title: "Ocritech Rayo",
    name: "Top_Ocritech_Rayo",
    isShortDesc: false,
  },
  {
    id: 3016,
    title: "Ocritech Roll",
    name: "Top_Ocritech_Roll",
    isShortDesc: false,
  },
  {
    id: 3017,
    title: "Porcelain Cover",
    name: "Top_Porcelain_Cover",
    isShortDesc: false,
  },
  {
    id: 3018,
    title: "Porcelain Prisma",
    name: "Top_Porcelain_Prisma",
    isShortDesc: false,
  },
  {
    id: 3019,
    title: "Porcelain Quadra",
    name: "Top_Porcelain_Quadra",
    isShortDesc: false,
  },
  {
    id: 3020,
    title: "Porcelain Strip",
    name: "Top_Porcelain_Strip",
    isShortDesc: false,
  },
  {
    id: 3021,
    title: "Syntesi",
    name: "Top_Syntesi",
    isShortDesc: false,
  },
  {
    id: 3022,
    title: "Tekorlux Quadra",
    name: "Top_Tekorlux_Quadra",
    isShortDesc: false,
  },
  {
    id: 3023,
    title: "Tekorlux Rectangular",
    name: "Top_Tekorlux_Rectangular",
    isShortDesc: false,
  },
  {
    id: 3024,
    title: "Tekorlux Ron",
    name: "Top_Tekorlux_Ron",
    isShortDesc: false,
  },
  {
    id: 3025,
    title: "Tekorlux Trip",
    name: "Top_Tekorlux_Trip",
    isShortDesc: false,
  },
  {
    id: 3026,
    title: "Tekormud Tivi",
    name: "Top_Tekormud_Tivi",
    isShortDesc: false,
  },
];
