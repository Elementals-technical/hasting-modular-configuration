import type { ReactNode } from "react";

export type AccordionConfig = {
  id: string;
  title: string;
  defaultOpen?: boolean;
  content: ReactNode;
};
