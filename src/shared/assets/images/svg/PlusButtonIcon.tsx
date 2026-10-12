import { Plus as LucidePlus } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: number; height?: number; color?: string };

export const PlusButtonIcon = ({ width = 36, height = 36, color = "#AC5331" }: Props) => (
  <AppIcon
    icon={LucidePlus}
    width={width}
    height={height}
    color="white"
    style={{ background: color, borderRadius: "50%", padding: width / 6, boxSizing: "border-box" }}
  />
);
