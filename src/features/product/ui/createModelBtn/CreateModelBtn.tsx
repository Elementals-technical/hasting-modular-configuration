import { useNavigate } from "react-router-dom";

import { PlusIcon } from "@/shared/assets/images/svg/PlusIcon";
import { ROUTES } from "@/shared";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { resetPrebuiltProducts } from "@/entities/product/model/store/slice";

import s from "./CreateModelBtn.module.scss";

export const CreateModelBtn = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleNavigate = () => {
    dispatch(resetPrebuiltProducts());
    // removeAllProducts();

    navigate(ROUTES.CUSTOM);
  };

  return (
    <div className={s.createModel}>
      <div className={s.selectArea} onClick={handleNavigate}>
        <PlusIcon />
      </div>
      <div className={s.title}>Create Your Own</div>
      <div className={s.desc}>Build your own custom, tailored concept</div>
    </div>
  );
};
