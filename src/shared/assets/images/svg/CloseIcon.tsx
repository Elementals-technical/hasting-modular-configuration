import { X as LucideX } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { fill?: string };

export const CloseIcon = ({ fill = "white" }: Props) => <AppIcon icon={LucideX} size={24} color={fill} />;
