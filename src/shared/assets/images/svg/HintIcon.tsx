import { MessageCircle as LucideMessageCircle } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { fill?: string };

export const HintIcon = ({ fill = "#AC5331" }: Props) => <AppIcon icon={LucideMessageCircle} size={20} color={fill} />;
