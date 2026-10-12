import type { LucideProps } from "lucide-react";
import { X } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

export const CloseIconSVG = ({ width = 12, height = 12, ...props }: LucideProps) => (
  <AppIcon {...props} icon={X} width={width} height={height} />
);
