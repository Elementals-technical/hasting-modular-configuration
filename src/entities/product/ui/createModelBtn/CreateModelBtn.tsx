import { useLocation } from "react-router-dom";

import { PlusIcon } from "@/shared/assets/images/svg/PlusIcon.tsx";
import { ROUTES } from "@/shared";
import { COLLECTION_ID_QUERY_PARAM } from "@/features/saveConfiguration/lib/configurationUrlParams";

import s from "./CreateModelBtn.module.scss";
import { useCollectionNavigate } from "@/features/collectionCustomization";

type CreateModelBtnProps = {
  /** Starts an empty composition before Custom opens; the page clears the scene through C's command. */
  onCreate: () => Promise<void>;
};

export const CreateModelBtn = ({ onCreate }: CreateModelBtnProps) => {
  const navigate = useCollectionNavigate();
  const location = useLocation();

  const handleNavigate = async () => {
    await onCreate();

    const collectionId = new URLSearchParams(location.search).get(COLLECTION_ID_QUERY_PARAM);
    navigate(
      collectionId
        ? { pathname: ROUTES.CUSTOM, search: `${COLLECTION_ID_QUERY_PARAM}=${collectionId}` }
        : ROUTES.CUSTOM,
    );
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
