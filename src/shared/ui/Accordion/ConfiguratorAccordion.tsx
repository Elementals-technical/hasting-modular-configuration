import type { ReactNode } from "react";
import { Accordion } from "./Accordion";

interface ConfiguratorAccordionI {
  title: string;
  children: ReactNode;
}

export const ConfiguratorAccordion: React.FC<ConfiguratorAccordionI> = ({ title, children }) => (
  <Accordion.Root type="single" collapsible defaultValue="item-1">
    <Accordion.Item value="item-1">
      <Accordion.Trigger>{title}</Accordion.Trigger>
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
);
