import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import image from "../../../../shared/assets/images/png/img_png.png";

import s from "./RightCabinetStyleSidebar.module.scss";

export const RightCabinetStyleSidebar = () => {
  const handleSelect = () => {};

  return (
    <div className={s.cabinetStyleSidebar}>
      <div className={s.arrow}>
        <ArrowRight width="16" />
      </div>
      <div className={s.content}>
        <div className={s.contentItem}>
          <div>Width</div>
          <FilterSelection
            label={"Width"}
            options={[
              { label: "60", value: "60" },
              { label: "65", value: "65" },
              { label: "70", value: "70" },
            ]}
            onSelect={handleSelect}
          />
        </div>

        <div className={s.contentItem}>
          <div>Depth</div>
          <FilterSelection
            label={"Depth"}
            options={[
              { label: "60", value: "60" },
              { label: "65", value: "65" },
              { label: "70", value: "70" },
            ]}
            onSelect={handleSelect}
          />
        </div>

        <div className={s.contentItem}>
          <div>Upper Groove</div>
          <FilterSelection
            label={"Upper Groove"}
            options={[
              { label: "Upper Groove", value: "60" },
              { label: "Upper Groove", value: "65" },
              { label: "Upper Groove", value: "70" },
            ]}
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
