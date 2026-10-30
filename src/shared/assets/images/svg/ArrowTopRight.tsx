import { ArrowUpRight as LucideArrowUpRight } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { color?: string };

export const ArrowTopRight = ({ color = "white" }: Props) => (
  <AppIcon icon={LucideArrowUpRight} size={15} color={color} />
);
