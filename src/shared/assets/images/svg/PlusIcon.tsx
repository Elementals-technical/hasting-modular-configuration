import { Plus as LucidePlus } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

export const PlusIcon = ({ size = 13 }: { size?: number }) => (
  <AppIcon icon={LucidePlus} size={size} color="#282828" />
);
