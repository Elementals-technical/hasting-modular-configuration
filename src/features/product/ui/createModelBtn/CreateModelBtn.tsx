import { useNavigate } from "react-router-dom";

import { PlusIcon } from "@/shared/assets/images/svg/PlusIcon";
import { ROUTES } from "@/shared";

import s from "./CreateModelBtn.module.scss";

export const CreateModelBtn = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
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
