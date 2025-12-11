import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import image from "../../../../shared/assets/images/png/img_png.png";

import s from "./RightCabinetStyleSidebar.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar } from "../../model/store/slice";
import { getDimensionOptions } from "@/entities/product/model/store/selectors";

export const RightCabinetStyleSidebar = () => {
  const dispatch = useAppDispatch();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);
  const dimensionOptions = useAppSelector(getDimensionOptions);

  const handleSelect = () => {};

  const handleCloseSidebar = () => {
    dispatch(setOpenStyleSidebar(false));
  };

  return (
    <div className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}>
      <div className={s.arrow} onClick={handleCloseSidebar}>
        <ArrowRight width="16" />
      </div>
      <div className={s.content}>
        <div className={s.contentItem}>
          <div>Width</div>
          <FilterSelection
            label={"Width"}
            options={dimensionOptions.width}
            onSelect={handleSelect}
          />
        </div>

        <div className={s.contentItem}>
          <div>Depth</div>
          <FilterSelection
            label={"Depth"}
            options={dimensionOptions.depth}
            onSelect={handleSelect}
          />
        </div>

        <div className={s.contentItem}>
          <div>Height</div>
          <FilterSelection
            label={"Height"}
            options={dimensionOptions.height}
            onSelect={handleSelect}
          />
        </div>

        <div className={s.image}>
          <img src={image} alt="image" />
        </div>
      </div>
      <div className={s.bottomText}>Click the + button to place your cabinet</div>
    </div>
  );
};
