import { useParams } from "react-router-dom";

import img_desc from "@/shared/assets/images/png/descr_image.png";

import s from "./ModelDetailsPage.module.scss";
import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

export const ModelDetailsPage = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const selectedModel = productMockData.find(({ id }) => id === Number(modelId));

  const presetProducts = selectedModel?.presetProducts ?? [];
  const detailsImage = selectedModel?.img ?? img_desc;
  const stepLabels = ["A", "B", "C", "D", "E"];

  const hasPresetProducts = presetProducts.length > 0;
  const isSingleCabinet = presetProducts.length === 1;
  const isSinkBaseSideCabinetOneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D";
  const isSinkBaseSideCabinetTwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D";
  const isSinkBaseSideCabinetMatchedDrawerPair =
    isSinkBaseSideCabinetOneDrawerPair || isSinkBaseSideCabinetTwoDrawerPair;
  const isDoubleSinkBaseOneDrawer236Pair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01;
  const isSideCabinet98TwoDrawerPlusSinkBase236TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 25) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01;
  const isSinkBase276TwoDrawerOpenShelf138SideCabinet138TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Open-Shelf" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isOpenShelf138SideCabinet197TwoDrawerSinkBase236TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Open-Shelf" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Base" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 35) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 60) < 0.01;
  const isSideCabinet276OneDrawerSinkBase315OneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 80) < 0.01;
  const isSideCabinet236TwoDrawerSinkBase413TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 105) < 0.01;
  const isSideCabinet413TwoDrawerSinkBase472TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 105) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 120) < 0.01;
  const isSinkBase413TwoDrawerSideCabinet276TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 105) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 70) < 0.01;
  const isSinkBase276TwoDrawerSideCabinet315TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 80) < 0.01;
  const isSinkBase354TwoDrawerSideCabinet236TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01;
  const isSinkBase276TwoDrawerSideCabinet197TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 50) < 0.01;
  const isSinkBase276TwoDrawerSideCabinet138TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01;
  const isSinkBase315TwoDrawerSideCabinet138TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01;
  const isSinkBase276OneDrawerSideCabinet197OneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 50) < 0.01;
  const isSinkBase315OneDrawerSideCabinet138OneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01;
  const isSinkBase276OneDrawerSideCabinet138OneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01;
  const isSinkBase236OneDrawerSideCabinet98OneDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 25) < 0.01;
  const isSinkBase315TwoDrawerOpenShelf98SideCabinet197TwoDrawerOpenShelf98SinkBase315TwoDrawerFive =
    presetProducts.length === 5 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Open-Shelf" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[3]?.name === "Open-Shelf" &&
    presetProducts[4]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    presetProducts[4]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 25) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[3]?.Width ?? 0) - 25) < 0.01 &&
    Math.abs((presetProducts[4]?.Width ?? 0) - 80) < 0.01;
  const isSinkBase354OneDrawerOpenShelf138SideCabinet138OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Open-Shelf" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 35) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isSideCabinet138OneDrawerSinkBase354OneDrawerSideCabinet138OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 35) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isSideCabinet276OneDrawerSinkBase413OneDrawerOpenShelf138SideCabinet138OneDrawerFour =
    presetProducts.length === 4 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Open-Shelf" &&
    presetProducts[3]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    presetProducts[3]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 105) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01 &&
    Math.abs((presetProducts[3]?.Width ?? 0) - 35) < 0.01;
  const isSideCabinet236TwoDrawerSinkBase472TwoDrawerSideCabinet236TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 120) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 60) < 0.01;
  const isDoubleSinkBase472TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 120) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 120) < 0.01;
  const isDoubleSinkBase236TwoDrawerPair =
    presetProducts.length === 2 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01;
  const isSinkBase315OneDrawerSideCabinet315OneDrawerSinkBase315OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 80) < 0.01;
  const isSinkBase354OneDrawerSideCabinet236OneDrawerSinkBase354OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 90) < 0.01;
  const isSinkBase315OneDrawerOpenShelf236SinkBase315OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Open-Shelf" &&
    presetProducts[2]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 80) < 0.01;
  const isSinkBase354OneDrawerSideCabinet236OneDrawerSideCabinet236OneDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "1D" &&
    presetProducts[1]?.Drawers === "1D" &&
    presetProducts[2]?.Drawers === "1D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 60) < 0.01;
  const isSinkBase413TwoDrawerSideCabinet197TwoDrawerOpenShelf138Triple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Open-Shelf" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 105) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isSideCabinet197TwoDrawerSinkBase354TwoDrawerSideCabinet197TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 50) < 0.01;
  const isSinkBase354TwoDrawerSideCabinet236TwoDrawerSideCabinet138TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 90) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isSinkBase315TwoDrawerSideCabinet236TwoDrawerSideCabinet138TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Base" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 35) < 0.01;
  const isSideCabinet197TwoDrawerSinkBase276TwoDrawerOpenShelf197Triple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Open-Shelf" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 70) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 50) < 0.01;
  const isSideCabinet315TwoDrawerSideCabinet197TwoDrawerSinkBase413TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Cabinet" &&
    presetProducts[2]?.name === "Sink-Base" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 80) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 50) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 105) < 0.01;
  const isSideCabinet236TwoDrawerSinkBase413TwoDrawerSideCabinet236TwoDrawerTriple =
    presetProducts.length === 3 &&
    presetProducts[0]?.name === "Sink-Cabinet" &&
    presetProducts[1]?.name === "Sink-Base" &&
    presetProducts[2]?.name === "Sink-Cabinet" &&
    presetProducts[0]?.Drawers === "2D" &&
    presetProducts[1]?.Drawers === "2D" &&
    presetProducts[2]?.Drawers === "2D" &&
    Math.abs((presetProducts[0]?.Width ?? 0) - 60) < 0.01 &&
    Math.abs((presetProducts[1]?.Width ?? 0) - 105) < 0.01 &&
    Math.abs((presetProducts[2]?.Width ?? 0) - 60) < 0.01;

  const cmToIn = (value: number) => value / 2.54;
  const roundOneDecimal = (value: number) => Number(value.toFixed(1));
  const formatInches = (value: number) => {
    const roundedToOne = Number(value.toFixed(1));
    return `${roundedToOne % 1 === 0 ? roundedToOne.toFixed(0) : roundedToOne.toFixed(1)}"`;
  };

  const getCabinetLabel = (name: string) => {
    if (name === "Sink-Base") return "Sink Base";
    if (name === "Sink-Cabinet") return "Side Cabinet";
    if (name === "Open-Shelf") return "Open Shelf";
    if (name === "Side-Shelf") return "Side Shelf";
    return name.replace(/-/g, " ");
  };

  const getDrawerLabel = (drawers?: string) => {
    if (drawers === "1D") return "1-Drawer";
    if (drawers === "2D") return "2-Drawer";
    if (drawers === "1DWID") return "1-DWID";
    return "";
  };

  const formatInchesFromCm = (value?: number) => {
    if (typeof value !== "number") return null;
    const inches = roundOneDecimal(value / 2.54);
    return `${inches % 1 === 0 ? inches.toFixed(0) : inches.toFixed(1)}"`;
  };

  const totalWidthInches = roundOneDecimal(
    presetProducts.reduce((acc, item) => acc + roundOneDecimal(cmToIn(item.Width ?? 0)), 0),
  );
  const totalWidthCm = presetProducts.reduce((acc, item) => acc + (item.Width ?? 0), 0);
  const markerTop = isSingleCabinet
    ? "75%"
    : isSinkBase315TwoDrawerSideCabinet138TwoDrawerPair
      ? "70%"
    : isSideCabinet98TwoDrawerPlusSinkBase236TwoDrawerPair
      ? "72%"
    : isSinkBase236OneDrawerSideCabinet98OneDrawerPair
      ? "72%"
    : isSinkBase276OneDrawerSideCabinet138OneDrawerPair
      ? "70%"
    : isSinkBase276TwoDrawerSideCabinet138TwoDrawerPair
      ? "70%"
    : isSinkBase315OneDrawerSideCabinet138OneDrawerPair
      ? "68%"
    : isSinkBase276OneDrawerSideCabinet197OneDrawerPair
      ? "67%"
    : isSinkBase276TwoDrawerSideCabinet197TwoDrawerPair
      ? "68%"
    : isDoubleSinkBase236TwoDrawerPair
      ? "68%"
    : isSinkBase354TwoDrawerSideCabinet236TwoDrawerPair
      ? "65%"
    : isSinkBase276TwoDrawerSideCabinet315TwoDrawerPair
      ? "65%"
    : isSideCabinet197TwoDrawerSinkBase354TwoDrawerSideCabinet197TwoDrawerTriple
      ? "63%"
      : isSinkBase413TwoDrawerSideCabinet197TwoDrawerOpenShelf138Triple
        ? "63%"
        : isSinkBase354OneDrawerSideCabinet236OneDrawerSideCabinet236OneDrawerTriple
          ? "61%"
          : isSinkBase315OneDrawerOpenShelf236SinkBase315OneDrawerTriple
            ? "63%"
            : isSideCabinet413TwoDrawerSinkBase472TwoDrawerPair
              ? "62%"
              : isSideCabinet236TwoDrawerSinkBase413TwoDrawerSideCabinet236TwoDrawerTriple
                ? "61%"
                : isSideCabinet315TwoDrawerSideCabinet197TwoDrawerSinkBase413TwoDrawerTriple
                  ? "61%"
                  : isSinkBase354OneDrawerSideCabinet236OneDrawerSinkBase354OneDrawerTriple
                    ? "60%"
                    : isSinkBase315OneDrawerSideCabinet315OneDrawerSinkBase315OneDrawerTriple
                      ? "61%"
                      : isDoubleSinkBase472TwoDrawerPair
                        ? "61%"
                        : isSideCabinet236TwoDrawerSinkBase472TwoDrawerSideCabinet236TwoDrawerTriple
                          ? "62%"
                          : isSideCabinet276OneDrawerSinkBase413OneDrawerOpenShelf138SideCabinet138OneDrawerFour
                            ? "60%"
                            : isSinkBase315TwoDrawerOpenShelf98SideCabinet197TwoDrawerOpenShelf98SinkBase315TwoDrawerFive
                              ? "60%"
                              : isSinkBase413TwoDrawerSideCabinet276TwoDrawerPair
                                ? "65%"
                                : isSideCabinet236TwoDrawerSinkBase413TwoDrawerPair
                                  ? "66%"
                                  : isSideCabinet138OneDrawerSinkBase354OneDrawerSideCabinet138OneDrawerTriple
                                    ? "64%"
                                    : isSinkBase354OneDrawerOpenShelf138SideCabinet138OneDrawerTriple
                                      ? "66%"
                                      : isSideCabinet276OneDrawerSinkBase315OneDrawerPair
                                        ? "67%"
                                        : isOpenShelf138SideCabinet197TwoDrawerSinkBase236TwoDrawerTriple
                                          ? "67%"
                                          : isSinkBase276TwoDrawerOpenShelf138SideCabinet138TwoDrawerTriple
                                            ? "68%"
                                            : isDoubleSinkBaseOneDrawer236Pair
                                              ? "69%"
                                              : isSinkBaseSideCabinetMatchedDrawerPair
                                                ? "63%"
                                                : "63%";
  const markerPositions = presetProducts.map((item, index) => {
    if (totalWidthCm <= 0) {
      const equalStep = 100 / (presetProducts.length + 1);
      return equalStep * (index + 1);
    }

    const previousWidth = presetProducts
      .slice(0, index)
      .reduce((acc, currentItem) => acc + (currentItem.Width ?? 0), 0);
    const currentWidth = item.Width ?? 0;
    const centerCm = previousWidth + currentWidth / 2;

    return (centerCm / totalWidthCm) * 100;
  });
  const adjustedMarkerPositions = (() => {
    if (
      isSideCabinet276OneDrawerSinkBase413OneDrawerOpenShelf138SideCabinet138OneDrawerFour &&
      markerPositions.length > 3
    ) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 20.2857;
        if (index === 2) return 73.5714;
        if (index === 3) return 85.8571;
        return position;
      });
    }

    if (isSinkBase315OneDrawerSideCabinet315OneDrawerSinkBase315OneDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 20.6667;
        if (index === 2) return 78.3333;
        return position;
      });
    }

    if (isSideCabinet236TwoDrawerSinkBase472TwoDrawerSideCabinet236TwoDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 20.5;
        if (index === 2) return 79.5;
        return position;
      });
    }

    if (isSideCabinet236TwoDrawerSinkBase413TwoDrawerSideCabinet236TwoDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 21.3333;
        if (index === 2) return 80.6667;
        return position;
      });
    }

    if (isSinkBase354OneDrawerSideCabinet236OneDrawerSideCabinet236OneDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 26.4286;
        if (index === 1) return 56.1429;
        if (index === 2) return 79.7143;
        return position;
      });
    }

    if (isSinkBase413TwoDrawerSideCabinet197TwoDrawerOpenShelf138Triple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 1) return 65.4211;
        if (index === 2) return 81.7895;
        return position;
      });
    }

    if (isSideCabinet197TwoDrawerSinkBase354TwoDrawerSideCabinet197TwoDrawerTriple && markerPositions.length > 1) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 22.1579;
        if (index === 2) return 78.8421;
        return position;
      });
    }

    if (isSinkBase354TwoDrawerSideCabinet236TwoDrawerSideCabinet138TwoDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 2) return 82.5405;
        return position;
      });
    }

    if (isSinkBase315TwoDrawerSideCabinet236TwoDrawerSideCabinet138TwoDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 2) return 82;
        return position;
      });
    }

    if (isSideCabinet197TwoDrawerSinkBase276TwoDrawerOpenShelf197Triple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 23.7059;
        if (index === 2) return 78.2941;
        return position;
      });
    }

    if (isSinkBaseSideCabinetMatchedDrawerPair && markerPositions.length > 1) {
      return markerPositions.map((position, index) => (index === 1 ? 76 : position));
    }

    if (isSideCabinet98TwoDrawerPlusSinkBase236TwoDrawerPair && markerPositions.length > 0) {
      return markerPositions.map((position, index) => (index === 0 ? 23 : position));
    }

    if (isSideCabinet236TwoDrawerSinkBase413TwoDrawerPair && markerPositions.length > 0) {
      return markerPositions.map((position, index) => (index === 0 ? 25.1818 : position));
    }

    if (isSinkBase276TwoDrawerOpenShelf138SideCabinet138TwoDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 1) return 60;
        if (index === 2) return 80;
        return position;
      });
    }

    if (isSinkBase354OneDrawerOpenShelf138SideCabinet138OneDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 1) return 63.1875;
        if (index === 2) return 81.0625;
        return position;
      });
    }

    if (isSideCabinet138OneDrawerSinkBase354OneDrawerSideCabinet138OneDrawerTriple && markerPositions.length > 2) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 24.9375;
        if (index === 1) return 55;
        if (index === 2) return 82.0625;
        return position;
      });
    }

    if (isOpenShelf138SideCabinet197TwoDrawerSinkBase236TwoDrawerTriple && markerPositions.length > 1) {
      return markerPositions.map((position, index) => {
        if (index === 0) return 26;
        if (index === 1) return 48;
        return position;
      });
    }

    return markerPositions;
  })();
  const maxDepthInches = presetProducts.reduce(
    (acc, item) => Math.max(acc, roundOneDecimal(cmToIn(item.Depth ?? 0))),
    0,
  );
  const maxHeightInches = presetProducts.reduce(
    (acc, item) => Math.max(acc, roundOneDecimal(cmToIn(item.Height ?? 0))),
    0,
  );

  return (
    <div className={s.modelDetails}>
      <div className={s.detailsDimensions}>
        <div className={s.imageWithMarkers}>
          <div className={s.image}>
            <img src={detailsImage} alt={`${selectedModel?.title ?? "Model"} image`} />
          </div>

          {hasPresetProducts ? (
            <div className={s.imageMarkers} aria-label="Cabinet sequence markers" style={{ top: markerTop }}>
              {presetProducts.map((_, index) => (
                <span
                  key={`image-marker-${index}`}
                  className={`${s.stepIcon} ${s.imageMarkerIcon}`}
                  style={{ left: `${adjustedMarkerPositions[index]}%` }}
                >
                  {stepLabels[index] ?? String(index + 1)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className={s.dimensions}>
          <div className={s.dimensions_titleBlock}>
            <h4 className={s.title}>Dimensions</h4>
            {hasPresetProducts ? (
              <>
                <p>{formatInches(totalWidthInches)} Wide</p>
                <p>{formatInches(maxDepthInches)} Deep</p>
                <p>{formatInches(maxHeightInches)} High</p>
              </>
            ) : (
              <>
                <p>— Wide</p>
                <p>— Deep</p>
                <p>— High</p>
              </>
            )}
          </div>

          <div className={s.dimensionsBreakdown}>
            <h4>Cabinet breakdown</h4>

            <ul>
              {presetProducts.map((i, index) => {
                const widthInches = formatInchesFromCm(i.Width);
                const drawerLabel = getDrawerLabel(i.Drawers);
                const detailsParts = [widthInches, drawerLabel].filter(Boolean).join(" ");

                return (
                  <li key={`${i.name}-${index}`}>
                    <span className={s.breakdownItem}>
                      <span className={s.stepIcon}>{stepLabels[index] ?? String(index + 1)}</span>
                      <span>
                        {getCabinetLabel(i.name)}
                        {detailsParts ? ` | ${detailsParts}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className={s.detailsDescription}>
        <div>
          <h4 className={s.title}>Cabinet Characteristics</h4>

          <ul className={s.descList}>
            <li>Soft-close, ergonomic drawer system</li>
            <li>Metal drawer glide structure</li>
            <li>Dark anthracite internal drawer base finish</li>
            <li>Non-slip, scratch resistant base</li>
            <li>Melamine cabinet structure</li>
            <li>Carb2 compliant materials</li>
          </ul>
        </div>

        <div>
          <h4 className={s.title}>Production | Capacity</h4>

          <ul className={s.descList}>
            <li>Italian-made, designed and built-to-order</li>
            <li>Eco-conscious production methods</li>
            <li>Max weight capacity 40Kg (88lb per cabinet)</li>
            <li>Rigorous material testing for ease of upkeep</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
