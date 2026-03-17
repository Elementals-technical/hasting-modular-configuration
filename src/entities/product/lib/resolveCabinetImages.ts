import sinkBasePto50WithBasin from "@/shared/assets/images/jpeg/SinkBase2D_PTO_with_50_height_withbasin.jpg";
import sinkBaseCentral53WithBasin from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height_withbasin.jpg";
import sinkCabinetPto50 from "@/shared/assets/images/jpeg/SinkBase2D_PTO_50_height.jpg";
import sinkCabinetCentral53 from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height.jpg";

import sinkCabinet1DStyle50 from "@/shared/assets/images/png/SinkBase1D_PTO.png";
import sinkCabinet1DStyle5356 from "@/shared/assets/images/png/SinkBase1D_upperG.png";
import twoDrawer50Height from "@/shared/assets/images/jpeg/SinkBase2D_PTO_50_height.jpg";
import twoDrawer53Height from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height.jpg";
import twoDrawer56Height from "@/shared/assets/images/jpeg/SideCabinet2D_default_without_basin.jpg";
import sideCabinet56Height from "@/shared/assets/images/jpeg/sinkBase56_default.jpg";

import sinkBase1DStyle50 from "@/shared/assets/images/png/SinkBase1D_PTOShade.png";
import sinkBase1DStyle5356 from "@/shared/assets/images/png/SinkBase1D_upperGShade.png";

import sinkBase2DStyle50 from "@/shared/assets/images/png/SinkBase2D_PTOShade.png";
import sinkBase2DStyle53 from "@/shared/assets/images/png/SinkBase2D_centralGShade.png";
import sinkBase2DStyle56 from "@/shared/assets/images/png/SinkBase2D_upperGShade.png";

export const resolveCabinetTypeImage = (
  name: string | undefined,
  height: number,
  drawerGroup?: "single" | "double" | null,
  fallback?: string,
) => {
  const isSingleDrawer = drawerGroup === "single";
  const isDoubleDrawer = drawerGroup === "double";

  if (name === "Sink-Base") {
    if (isSingleDrawer) {
      if (height === 50) return sinkBase1DStyle50;
      return sinkBase1DStyle5356;
    }

    if (isDoubleDrawer) {
      if (height === 50) return sinkBasePto50WithBasin;
      if (height === 53) return sinkBaseCentral53WithBasin;
      return sinkBase2DStyle56;
    }

    return fallback;
  }

  if (name === "Sink-Cabinet") {
    if (isSingleDrawer) {
      if (height === 50) return sinkCabinet1DStyle50;
      return sinkCabinet1DStyle5356;
    }

    if (isDoubleDrawer) {
      if (height === 50) return sinkCabinetPto50;
      if (height === 53) return sinkCabinetCentral53;
      if (height === 56) return sideCabinet56Height;
      return fallback;
    }

    return fallback;
  }

  return fallback;
};

export const resolveCabinetStyleImage = (
  value: string | undefined,
  height: number,
  cabinetType?: string | null,
  fallback?: string,
) => {
  const withBasin = cabinetType === "Sink-Base";

  if (value === "1" || value === "1+inner") {
    if (withBasin) {
      if (height === 50) return sinkBase1DStyle50;
      return sinkBase1DStyle5356;
    } else {
      if (height === 50) return sinkCabinet1DStyle50;
      return sinkCabinet1DStyle5356;
    }
  }

  if (value === "2") {
    if (withBasin) {
      if (height === 50) return sinkBase2DStyle50;
      if (height === 53) return sinkBase2DStyle53;
      return sinkBase2DStyle56;
    } else {
      if (height === 50) return twoDrawer50Height;
      if (height === 53) return twoDrawer53Height;
      if (height === 56) return twoDrawer56Height;
      return fallback;
    }
  }

  return fallback;
};
