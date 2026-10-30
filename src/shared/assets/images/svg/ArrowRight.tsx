import { ArrowRight as LucideArrowRight } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string; stroke?: string };

export const ArrowRight = ({ width = "20", height = "20", stroke = "#AC5331" }: Props) => (
  <AppIcon icon={LucideArrowRight} width={width} height={height} color={stroke} />
);
