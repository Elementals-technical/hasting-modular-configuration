import { LoaderIcon } from "@/shared/assets/images/svg/LoaderIcon";
import s from "./LoaderBlock.module.scss";

export const LoaderBlock = () => {
  return (
    <div className={s.loaderBlock}>
      <div>
        <LoaderIcon />
      </div>
    </div>
  );
};
