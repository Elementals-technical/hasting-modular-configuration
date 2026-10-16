import type { LucideProps } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

export const ChevronDownIconSVG = ({ width = 16, height = 16, ...props }: LucideProps) => (
  <AppIcon {...props} icon={ChevronDown} width={width} height={height} />
);
