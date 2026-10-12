import { Search as LucideSearch } from "lucide-react";
import { AppIcon } from "@/shared/ui/AppIcon/AppIcon";

type Props = { width?: string; height?: string };

export const Search = ({ width = "20", height = "20" }: Props) => (
  <AppIcon icon={LucideSearch} width={width} height={height} color="#282828" />
);
