import { useLocation } from "react-router-dom";

import { PlusIcon } from "@/shared/assets/images/svg/PlusIcon.tsx";
import { ROUTES } from "@/shared";
import { useAppDispatch } from "@/shared/hooks/store/redux.ts";
import { resetPrebuiltProducts } from "@/entities/product/model/store/slice.ts";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { resetSidePanels } from "@/utils/functions/playcanvas/resetSidePanels";
import { COLLECTION_ID_QUERY_PARAM } from "@/features/saveConfiguration/lib/configurationUrlParams";

import s from "./CreateModelBtn.module.scss";
import { useCollectionNavigate } from "@/features/collectionCustomization";

export const CreateModelBtn = () => {
  const dispatch = useAppDispatch();
  const navigate = useCollectionNavigate();
  const location = useLocation();

  const handleNavigate = async () => {
    await resetSidePanels();
    await removeAllProducts();
    dispatch(resetPrebuiltProducts());

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
