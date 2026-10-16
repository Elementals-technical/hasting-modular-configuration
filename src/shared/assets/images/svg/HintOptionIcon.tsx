import { Info as LucideInfo } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string };

export const HintOptionIcon = ({ width = "14", height = "14" }: Props) => (
  <AppIcon icon={LucideInfo} width={width} height={height} color="#282828" />
);
