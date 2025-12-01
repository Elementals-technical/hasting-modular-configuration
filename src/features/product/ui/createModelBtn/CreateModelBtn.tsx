import { PlusIcon } from "@/shared/assets/images/svg/PlusIcon";

import s from "./CreateModelBtn.module.scss";

export const CreateModelBtn = () => {
  return (
    <div className={s.createModel}>
      <div className={s.selectArea}>
        <PlusIcon />
      </div>
      <div className={s.title}>Create Your Own</div>
      <div className={s.desc}>Build your own custom, tailored concept</div>
    </div>
  );
};
