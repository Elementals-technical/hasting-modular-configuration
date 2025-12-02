import { InstructionPopup } from "@/features/popups/ui/InstructionPopup/InstructionPopup";
import s from "./CabinetBuilderPage.module.scss";

export const CabinetBuilderPage = () => {
  return (
    <div className={s.cabinetBuilder}>
      <InstructionPopup />
    </div>
  );
};
