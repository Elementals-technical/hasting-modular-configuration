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
  const maxDepthInches = presetProducts.reduce((acc, item) => Math.max(acc, roundOneDecimal(cmToIn(item.Depth ?? 0))), 0);
  const maxHeightInches = presetProducts.reduce(
    (acc, item) => Math.max(acc, roundOneDecimal(cmToIn(item.Height ?? 0))),
    0,
  );

  return (
    <div className={s.modelDetails}>
      <div className={s.detailsDimensions}>
        <div className={s.image}>
          <img src={detailsImage} alt={`${selectedModel?.title ?? "Model"} image`} />
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
                      <span className={s.stepIcon}>{stepLabels[index]}</span>
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
