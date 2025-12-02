import { useEffect, useState } from "react";

interface UseMountPropsI {
  opened: boolean;
  animationDurationMs?: number;
}

interface UseMountReturnI {
  mounted: boolean;
}

export const useMount = ({ opened, animationDurationMs = 300 }: UseMountPropsI): UseMountReturnI => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (opened && !mounted) {
      setMounted(true);
    } else if (!opened && mounted) {
      setTimeout(() => {
        setMounted(false);
      }, animationDurationMs);
    }
  }, [opened]);

  return {
    mounted,
  };
};
