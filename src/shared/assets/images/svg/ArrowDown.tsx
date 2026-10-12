import { ChevronDown as LucideChevronDown } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string; fill?: string };

export const ArrowDown = ({ width = "8", height = width, fill = "black" }: Props) => (
  <AppIcon icon={LucideChevronDown} width={width} height={height} color={fill} />
);
