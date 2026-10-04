import type { ReactNode } from "react";

/** Test stand-in: every section is an open, labelled region. */
export const ConfiguratorAccordionGroup = ({ children }: { children: ReactNode }) => <div>{children}</div>;

export const ConfiguratorAccordionItem = ({ children, title }: { children: ReactNode; title: string }) => (
  <section aria-label={title}>{children}</section>
);
