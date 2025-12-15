import { Link, useParams } from "react-router-dom";

import { StepAIcon } from "@/shared/assets/images/svg/StepAIcon";
import img_desc from "@/shared/assets/images/png/descr_image.png";

import s from "./ModelDetailsPage.module.scss";
import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

export const ModelDetailsPage = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const selectedModel = productMockData.find(({ id }) => id === Number(modelId));

  const presetProducts = selectedModel?.presetProducts ?? [];

  return (
    <div className={s.modelDetails}>
      <div className={s.detailsDimensions}>
        <div className={s.image}>
          <img src={img_desc} alt="dimentions image" />
        </div>
        <div className={s.dimensions}>
          <div className={s.dimensions_titleBlock}>
            <h4 className={s.title}>Dimensions</h4>
            <p>51" Wide</p>
            <p>31" Deep</p>
          </div>

          <div className={s.dimensionsBreakdown}>
            <h4>Cabinet breakdown</h4>

            <ul>
              {presetProducts.map((i, index) => {
                return (
                  <li key={`${i.name}-${index}`}>
                    <Link to={"#"}>
                      <span className={s.stepIcon}>
                        <StepAIcon />
                      </span>
                      <span>{i.name}</span>
                    </Link>
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
