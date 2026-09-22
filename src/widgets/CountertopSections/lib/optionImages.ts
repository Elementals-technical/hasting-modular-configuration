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
import syntesiImage from "@/shared/assets/images/jpeg/basin/Syntesi.jpg";
import tiviImage from "@/shared/assets/images/jpeg/basin/Tivi.jpg";
import tripImage from "@/shared/assets/images/jpeg/basin/Trip.jpg";
import integratedImage from "@/shared/assets/images/png/countertop/Integrated.png";
import nettunoImage from "@/shared/assets/images/png/countertop/integrated/Nettuno.png";
import ovaleImage from "@/shared/assets/images/png/countertop/integrated/Ovale.png";
import vesselImage from "@/shared/assets/images/png/countertop/Vessel.png";
import vesselAquarius48Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Aquarius48.png";
import vesselBlade11Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Blade11.png";
import vesselBlade18Image from "@/shared/assets/images/png/countertop/vessel/Vessel_Blade18.png";
import vesselUrbanModoCoverImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Cover.png";
import vesselUrbanModoFlatImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Flat.png";
import vesselUrbanModoSeamImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanModo_Seam.png";
import vesselUrbanMorrisImage from "@/shared/assets/images/png/countertop/vessel/Vessel_UrbanMorris.png";

/** Pictures of the countertop style options, by profile value. */
export const countertopStyleOptionImages: Record<string, string> = {
  integrated: integratedImage,
  vessel: vesselImage,
};

/** Pictures of the basin and vessel options, by profile value. */
export const basinOptionImages: Record<string, string> = {
  Top_HPLPrisma: prismaImage,
  Top_HPLQuadra: quadraImage,
  Top_HPLCover: coverImage,
  Top_HPLStrip: stripImage,
  "Top_HPL/Fenix_Cover_Gres": fenixCoverImage,
  "Top_HPL/Fenix_Prisma_Gres": fenixPrismaImage,
  "Top_HPL/Fenix_Quadra_Gres": fenixQuadraImage,
  "Top_HPL/Fenix_Strip_Gres": fenixStripImage,
  Fenix_Strip_Gres: fenixStripImage,
  Top_Glass_Nettuno: nettunoImage,
  Top_Glass_Ovale: ovaleImage,
  Top_Mineralmarmo_Diamond: diamondImage,
  Top_Ocritech_Oly55: olly55Image,
  Top_Ocritech_Oly56: olly56Image,
  Top_Ocritech_Orion: orionImage,
  Top_Ocritech_Quadra: ocritechQuadraImage,
  Top_Ocritech_Rayo: rayoImage,
  Top_Ocritech_Roll: rollImage,
  Top_Porcelain_Cover: coverImage,
  Top_Porcelain_Prisma: prismaImage,
  Top_Porcelain_Quadra: quadraImage,
  Top_Porcelain_Strip: stripImage,
  Top_Tekorlux_Syntesi: syntesiImage,
  Top_Tekorlux_Quadra: ocritechQuadraImage,
  Top_Tekorlux_Rectangular: rectangularImage,
  Top_Tekorlux_Ron: ronImage,
  Top_Tekorlux_Trip: tripImage,
  Top_Tekormud_Tivi: tiviImage,
  Vessel_Blade11: vesselBlade11Image,
  Vessel_Blade18: vesselBlade18Image,
  Vessel_UrbanModo: vesselUrbanModoFlatImage,
  Vessel_UrbanModo_Flat: vesselUrbanModoFlatImage,
  Vessel_UrbanModo_Seam: vesselUrbanModoSeamImage,
  Vessel_UrbanModo_Cover: vesselUrbanModoCoverImage,
  Vessel_UrbanMorris: vesselUrbanMorrisImage,
  Vessel_Aquarius: vesselAquarius48Image,
};
