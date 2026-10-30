import { Pencil } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

export { CloseIcon, MoveIcon } from "@/features/cabinetPlacementDebug/ui/placementIcons";

export const EditIcon = ({ size = 11 }: { size?: number }) => <AppIcon icon={Pencil} size={size} />;
