import { ArrowLeft as LucideArrowLeft } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string; fill?: string };

export const ArrowLeft = ({ width = "20", height = "20", fill = "#AC5331" }: Props) => (
  <AppIcon icon={LucideArrowLeft} width={width} height={height} color={fill} />
);
