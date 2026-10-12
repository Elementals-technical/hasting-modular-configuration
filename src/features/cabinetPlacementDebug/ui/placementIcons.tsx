import { Move, X } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

/** Draft overlay icons. Colour follows `currentColor`. */
export const MoveIcon = ({ size = 29 }: { size?: number }) => <AppIcon icon={Move} size={size} />;

export const CloseIcon = ({ size = 10 }: { size?: number }) => <AppIcon icon={X} size={size} />;
