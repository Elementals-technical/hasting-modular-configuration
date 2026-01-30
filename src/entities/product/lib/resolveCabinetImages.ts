import sinkBasePto50WithBasin from "@/shared/assets/images/jpeg/SinkBase2D_PTO_with_50_height_withbasin.jpg";
import sinkBaseCentral53WithBasin from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height_withbasin.jpg";
import sinkCabinetPto50 from "@/shared/assets/images/jpeg/SinkBase2D_PTO_50_height.jpg";
import sinkCabinetCentral53 from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height.jpg";

import oneDrawer50Height from "@/shared/assets/images/jpeg/1_drawer_50_height.jpg";
import oneDrawerDefault from "@/shared/assets/images/jpeg/1_drawer_default.jpg";
import twoDrawer50Height from "@/shared/assets/images/jpeg/SinkBase2D_PTO_50_height.jpg";
import twoDrawer53Height from "@/shared/assets/images/jpeg/SinkBase2D_centralG_53_height.jpg";
import twoDrawer56Height from "@/shared/assets/images/jpeg/SideCabinet2D_default_without_basin.jpg";
import sideCabinet56Height from "@/shared/assets/images/jpeg/sinkBase56_default.jpg";

export const resolveCabinetTypeImage = (name: string | undefined, height: number, fallback?: string) => {
  if (name === "Sink-Base") {
    if (height === 50) return sinkBasePto50WithBasin;
    if (height === 53) return sinkBaseCentral53WithBasin;
    return fallback;
  }

  if (name === "Sink-Cabinet") {
    if (height === 50) return sinkCabinetPto50;
    if (height === 53) return sinkCabinetCentral53;
    if (height === 56) return sideCabinet56Height;
    return fallback;
  }

  return fallback;
};

export const resolveCabinetStyleImage = (value: string | undefined, height: number, fallback?: string) => {
  if (value === "1" || value === "1+inner") {
    // 1 Drawer / 1 Drawer With Inner Drawer
    if (height === 50) return oneDrawer50Height;
    if (height === 53 || height === 56) return oneDrawerDefault;
    return fallback;
  }

  if (value === "2") {
    // 2 Drawer
    if (height === 50) return twoDrawer50Height;
    if (height === 53) return twoDrawer53Height;
    if (height === 56) return twoDrawer56Height;
    return fallback;
  }

  return fallback;
};
