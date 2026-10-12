import type { LucideProps } from "lucide-react";
import { Check } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

export const CheckMarkIconSVG = ({ width = 16, height = 16, ...props }: LucideProps) => (
  <AppIcon {...props} icon={Check} width={width} height={height} />
);
