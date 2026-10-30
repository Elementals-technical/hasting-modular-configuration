import { X as LucideX } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string };

export const CloseBtnIcon = ({ width = "30", height = "30" }: Props) => (
  <AppIcon
    icon={LucideX}
    width={width}
    height={height}
    color="#282828"
    style={{ background: "#E5E6EA", borderRadius: "50%", padding: Number(width) / 6, boxSizing: "border-box" }}
  />
);
