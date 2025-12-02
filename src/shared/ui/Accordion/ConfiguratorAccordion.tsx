import type { ReactNode } from "react";
import { Accordion } from "./Accordion";

interface ConfiguratorAccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const ConfiguratorAccordion: React.FC<ConfiguratorAccordionProps> = ({
  title,
  children,
  defaultOpen = false,
}) => (
  <Accordion.Root type="single" collapsible defaultValue={defaultOpen ? "item-1" : undefined}>
    <Accordion.Item value="item-1">
      <Accordion.Trigger>{title}</Accordion.Trigger>
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
);
