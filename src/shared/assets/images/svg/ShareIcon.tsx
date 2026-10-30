import { Share2 as LucideShare2 } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { stroke?: string };

export const ShareIcon = ({ stroke = "#282828" }: Props) => <AppIcon icon={LucideShare2} size={20} color={stroke} />;
