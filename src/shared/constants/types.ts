import type { ReactNode } from "react";

export type AccordionConfig = {
  id: number;
  title: string;
  defaultOpen?: boolean;
  content: ReactNode;
};
