import prismaImage from "@/shared/assets/images/jpeg/prisma.jpg";
import quadraImage from "@/shared/assets/images/jpeg/quadro.jpg";
import coverImage from "@/shared/assets/images/jpeg/cover.jpg";
import stripImage from "@/shared/assets/images/jpeg/strip.jpg";
import fenixCoverImage from "@/shared/assets/images/jpeg/basin/fenix/fenix_Cover.jpg";
import fenixPrismaImage from "@/shared/assets/images/jpeg/basin/fenix/fenix_Prisma.jpg";
import fenixQuadraImage from "@/shared/assets/images/jpeg/basin/fenix/fenix_Quadra.jpg";
import fenixStripImage from "@/shared/assets/images/jpeg/basin/fenix/fenix_Strip.jpg";
import diamondImage from "@/shared/assets/images/jpeg/basin/Diamond.jpg";
import olly55Image from "@/shared/assets/images/jpeg/basin/Olly_55.jpg";
import olly56Image from "@/shared/assets/images/jpeg/basin/Olly_56.jpg";
import orionImage from "@/shared/assets/images/jpeg/basin/Orion.jpg";
import ocritechQuadraImage from "@/shared/assets/images/jpeg/basin/Quadra.jpg";
import rayoImage from "@/shared/assets/images/jpeg/basin/Rayo.jpg";
import rectangularImage from "@/shared/assets/images/jpeg/basin/Rectangular.jpg";
import rollImage from "@/shared/assets/images/jpeg/basin/Roll.jpg";
import ronImage from "@/shared/assets/images/jpeg/basin/Ron.jpg";
// import syntesiImage from "@/shared/assets/images/jpeg/basin/Syntesi.jpg";
import tiviImage from "@/shared/assets/images/jpeg/basin/Tivi.jpg";
import tripImage from "@/shared/assets/images/jpeg/basin/Trip.jpg";
import integratedImage from "@/shared/assets/images/png/countertop/Integrated.png";
import nettunoImage from "@/shared/assets/images/png/countertop/integrated/Nettuno.png";
import ovaleImage from "@/shared/assets/images/png/countertop/integrated/Ovale.png";
import vesselImage from "@/shared/assets/images/png/countertop/Vessel.png";
import vesselAquarius48Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Aquarius48.png";
import vesselBlade11Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Blade11.png";
import vesselBlade18Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Blade18.png";
import vesselFrameImage from "@/shared/assets/images/png/countertop/vessel/Vessel_Frame.png";
import vesselIrisImage from "@/shared/assets/images/png/countertop/vessel/Vessel_Iris.png";
import vesselUrbanModoCoverImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Cover.png";
import vesselUrbanModoFlatImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Flat.png";
import vesselUrbanModoSeamImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Seam.png";
import vesselUrbanMorrisImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanMorris.png";

export const optionsMockData = [
  {
    id: 1001,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 1002,
    title: "Colortech",
    desc: "Grigio fume 10F",
    isShortDesc: false,
  },
  {
    id: 1003,
    title: "Cemento",
    desc: "Centre 1A1",
    isShortDesc: false,
  },
  {
    id: 1004,
    title: "Cemento",
    desc: "Tortora 1A2",
    isShortDesc: false,
  },
  {
    id: 1005,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 1006,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 1007,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 1008,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
];

export const optionsMockData2 = [
  {
    id: 2001,
    title: "Integrated",
    isAvailable: false,
    isShortDesc: false,
    metadata: {
      image: integratedImage,
    },
  },
  {
    id: 2002,
    title: "Vessel",
    isAvailable: true,
    isShortDesc: false,
    metadata: {
      image: vesselImage,
    },
  },
];

export const optionsMockData3 = [
  {
    id: 3001,
    title: "HPL Prisma 50",
    name: "Top_HPLPrisma",
    isShortDesc: true,
    metadata: {
      image: prismaImage,
    },
  },
  {
    id: 3002,
    title: "HPL Quadra 50",
    name: "Top_HPLQuadra",
    isShortDesc: false,
    metadata: {
      image: quadraImage,
    },
  },
  {
    id: 3003,
    title: "HPL Cover 50",
    name: "Top_HPLCover",
    isShortDesc: false,
    metadata: {
      image: coverImage,
    },
  },
  {
    id: 3004,
    title: "HPL Strip 48",
    name: "Top_HPLStrip",
    isShortDesc: false,
    metadata: {
      image: stripImage,
    },
  },
  {
    id: 3005,
    title: "Fenix Cover 50",
    name: "Top_HPL/Fenix_Cover_Gres",
    isShortDesc: false,
    metadata: {
      image: fenixCoverImage,
    },
  },
  {
    id: 3006,
    title: "Fenix Prisma 50",
    name: "Top_HPL/Fenix_Prisma_Gres",
    isShortDesc: false,
    metadata: {
      image: fenixPrismaImage,
    },
  },
  {
    id: 3007,
    title: "Fenix Quadra 50",
    name: "Top_HPL/Fenix_Quadra_Gres",
    isShortDesc: false,
    metadata: {
      image: fenixQuadraImage,
    },
  },
  {
    id: 3008,
    title: "Fenix Strip 48",
    name: "Top_HPL/Fenix_Strip_Gres",
    isShortDesc: false,
    metadata: {
      image: fenixStripImage,
    },
  },
  {
    id: 3009,
    title: "Fenix Strip Gres",
    name: "Fenix_Strip_Gres",
    isShortDesc: false,
    metadata: {
      image: fenixStripImage,
    },
  },
  {
    id: 3010,
    title: "Glass Nettuno",
    name: "Top_Glass_Nettuno",
    isShortDesc: false,
    metadata: {
      image: nettunoImage,
    },
  },
  {
    id: 3011,
    title: "Glass Ovale",
    name: "Top_Glass_Ovale",
    isShortDesc: false,
    metadata: {
      image: ovaleImage,
    },
  },
  {
    id: 3012,
    title: "Mineralmarmo Diamond",
    name: "Top_Mineralmarmo_Diamond",
    isShortDesc: false,
    metadata: {
      image: diamondImage,
    },
  },
  {
    id: 3013,
    title: "Ocritech Oly 55",
    name: "Top_Ocritech_Oly55",
    isShortDesc: false,
    metadata: {
      image: olly55Image,
    },
  },
  {
    id: 3014,
    title: "Ocritech Oly 56",
    name: "Top_Ocritech_Oly56",
    isShortDesc: false,
    metadata: {
      image: olly56Image,
    },
  },
  {
    id: 3015,
    title: "Ocritech Orion",
    name: "Top_Ocritech_Orion",
    isShortDesc: false,
    metadata: {
      image: orionImage,
    },
  },
  {
    id: 3016,
    title: "Ocritech Quadra",
    name: "Top_Ocritech_Quadra",
    isShortDesc: false,
    metadata: {
      image: ocritechQuadraImage,
    },
  },
  {
    id: 3017,
    title: "Ocritech Rayo",
    name: "Top_Ocritech_Rayo",
    isShortDesc: false,
    metadata: {
      image: rayoImage,
    },
  },
  {
    id: 3018,
    title: "Ocritech Roll",
    name: "Top_Ocritech_Roll",
    isShortDesc: false,
    metadata: {
      image: rollImage,
    },
  },
  {
    id: 3019,
    title: "Porcelain Cover 48",
    name: "Top_Porcelain_Cover",
    isShortDesc: false,
    metadata: {
      image: coverImage,
    },
  },
  {
    id: 3020,
    title: "Porcelain Prisma 48",
    name: "Top_Porcelain_Prisma",
    isShortDesc: false,
    metadata: {
      image: prismaImage,
    },
  },
  {
    id: 3021,
    title: "Porcelain Quadra 48",
    name: "Top_Porcelain_Quadra",
    isShortDesc: false,
    metadata: {
      image: quadraImage,
    },
  },
  {
    id: 3022,
    title: "Porcelain Strip 48",
    name: "Top_Porcelain_Strip",
    isShortDesc: false,
    metadata: {
      image: stripImage,
    },
  },
  // {
  //   id: 3023,
  //   title: "HPL Syntesi 48",
  //   name: "Top_Syntesi",
  //   isShortDesc: false,
  //   metadata: {
  //     image: syntesiImage,
  //   },
  // },
  {
    id: 3024,
    title: "Tekorlux Quadra 50",
    name: "Top_Tekorlux_Quadra",
    isShortDesc: false,
    metadata: {
      image: ocritechQuadraImage,
    },
  },
  {
    id: 3025,
    title: "Tekorlux Rectangular 50",
    name: "Top_Tekorlux_Rectangular",
    isShortDesc: false,
    metadata: {
      image: rectangularImage,
    },
  },
  {
    id: 3026,
    title: "Tekorlux Ron 50",
    name: "Top_Tekorlux_Ron",
    isShortDesc: false,
    metadata: {
      image: ronImage,
    },
  },
  {
    id: 3027,
    title: "Tekorlux Trip 50",
    name: "Top_Tekorlux_Trip",
    isShortDesc: false,
    metadata: {
      image: tripImage,
    },
  },
  {
    id: 3028,
    title: "Tekormud TIVI",
    name: "Top_Tekormud_Tivi",
    isShortDesc: false,
    metadata: {
      image: tiviImage,
    },
  },
  {
    id: 3029,
    title: "Vessel Blade 11",
    name: "Vessel_Blade11",
    isShortDesc: false,
    metadata: {
      image: vesselBlade11Image,
    },
  },
  {
    id: 3030,
    title: "Vessel Blade 18",
    name: "Vessel_Blade18",
    isShortDesc: false,
    metadata: {
      image: vesselBlade18Image,
    },
  },
  {
    id: 3031,
    title: "Vessel Frame",
    name: "Vessel_Frame",
    isShortDesc: false,
    metadata: {
      image: vesselFrameImage,
    },
  },
  {
    id: 3032,
    title: "Vessel Iris",
    name: "Vessel_Iris",
    isShortDesc: false,
    metadata: {
      image: vesselIrisImage,
    },
  },
  {
    id: 3033,
    title: "Vessel Urban Modo",
    name: "Vessel_UrbanModo",
    isShortDesc: false,
    metadata: {
      image: vesselUrbanModoFlatImage,
    },
  },
  {
    id: 3034,
    title: "Vessel Urban Modo Flat",
    name: "Vessel_UrbanModo_Flat",
    isShortDesc: false,
    metadata: {
      image: vesselUrbanModoFlatImage,
    },
  },
  {
    id: 3035,
    title: "Vessel Urban Modo Seam",
    name: "Vessel_UrbanModo_Seam",
    isShortDesc: false,
    metadata: {
      image: vesselUrbanModoSeamImage,
    },
  },
  {
    id: 3036,
    title: "Vessel Urban Modo Cover",
    name: "Vessel_UrbanModo_Cover",
    isShortDesc: false,
    metadata: {
      image: vesselUrbanModoCoverImage,
    },
  },
  {
    id: 3037,
    title: "Vessel Urban Morris",
    name: "Vessel_UrbanMorris",
    isShortDesc: false,
    metadata: {
      image: vesselUrbanMorrisImage,
    },
  },
  {
    id: 3038,
    title: "Vessel Aquarius",
    name: "Vessel_Aquarius",
    isShortDesc: false,
    metadata: {
      image: vesselAquarius48Image,
    },
  },
];

export const optionsMockData4 = [
  {
    id: 10,
    title: “0.375\””,
    value: "0.375",
    isShortDesc: false,
    isSwatchWithHint: true,
  },
  {
    id: 17,
    title: "0.4”",
    value: "0.4",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 11,
    title: “0.5\””,
    value: "0.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 12,
    title: “2.5\””,
    value: "2.5",
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
    title: “5.125\””,
    value: "5.125",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 15,
    title: “5.5\””,
    value: "5.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
];
