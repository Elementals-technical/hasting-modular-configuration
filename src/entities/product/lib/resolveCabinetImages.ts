// SinkBases
import sinkBase1D_PTO from "@/shared/assets/images/png/cabinet_type/SinkBases/SinkBase1D_PTO.png";
import sinkBase1D_upperG from "@/shared/assets/images/png/cabinet_type/SinkBases/SinkBase1D_upperG.png";
import sinkBase2D_PTO from "@/shared/assets/images/png/cabinet_type/SinkBases/SinkBase2D_PTO.png";
import sinkBase2D_centralG from "@/shared/assets/images/png/cabinet_type/SinkBases/SinkBase2D_centralG.png";
import sinkBase2D_upperG from "@/shared/assets/images/png/cabinet_type/SinkBases/SinkBase2D_upperG.png";

// SideCabinet
import sideCabinet1D_PTO from "@/shared/assets/images/png/cabinet_type/SideCabinet/SinkBase1D_PTO.png";
import sideCabinet1D_upperG from "@/shared/assets/images/png/cabinet_type/SideCabinet/SinkBase1D_upperG.png";
import sideCabinet2D_PTO from "@/shared/assets/images/png/cabinet_type/SideCabinet/SinkBase2D_PTO.png";
import sideCabinet2D_centralG from "@/shared/assets/images/png/cabinet_type/SideCabinet/SinkBase2D_centralG.png";
import sideCabinet2D_upperG from "@/shared/assets/images/png/cabinet_type/SideCabinet/SideCabinet2D_upperG.png";

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
      if (height === 50) return sinkBase1D_PTO;
      return sinkBase1D_upperG;
    }

    if (isDoubleDrawer) {
      if (height === 50) return sinkBase2D_PTO;
      if (height === 53) return sinkBase2D_centralG;
      return sinkBase2D_upperG;
    }

    return fallback;
  }

  if (name === "Sink-Cabinet" || name === "Side-Cabinet") {
    if (isSingleDrawer) {
      if (height === 50) return sideCabinet1D_PTO;
      return sideCabinet1D_upperG;
    }

    if (isDoubleDrawer) {
      if (height === 50) return sideCabinet2D_PTO;
      if (height === 53) return sideCabinet2D_centralG;
      if (height === 56) return sideCabinet2D_upperG;
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
      if (height === 50) return sinkBase1D_PTO;
      return sinkBase1D_upperG;
    } else {
      if (height === 50) return sideCabinet1D_PTO;
      return sideCabinet1D_upperG;
    }
  }

  if (value === "2") {
    if (withBasin) {
      if (height === 50) return sinkBase2D_PTO;
      if (height === 53) return sinkBase2D_centralG;
      return sinkBase2D_upperG;
    } else {
      if (height === 50) return sideCabinet2D_PTO;
      if (height === 53) return sideCabinet2D_centralG;
      if (height === 56) return sideCabinet2D_upperG;
      return fallback;
    }
  }

  return fallback;
};
