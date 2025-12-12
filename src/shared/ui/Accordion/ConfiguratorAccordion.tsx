import type { ReactNode } from "react";
import { Accordion } from "./Accordion";

type ConfiguratorAccordionItemProps = {
  title: string;
  children: ReactNode;
  value: string;
};

type ConfiguratorAccordionGroupProps = {
  children: ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

// Group wrapper lets multiple accordion items share the same root (single open).
export const ConfiguratorAccordionGroup = ({
  children,
  defaultValue,
  value,
  onValueChange,
}: ConfiguratorAccordionGroupProps) => (
  <Accordion.Root type="single" collapsible defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
    {children}
  </Accordion.Root>
);

export const ConfiguratorAccordionItem = ({ title, children, value }: ConfiguratorAccordionItemProps) => (
  <Accordion.Item value={value}>
    <Accordion.Trigger>{title}</Accordion.Trigger>
    <Accordion.Content>{children}</Accordion.Content>
  </Accordion.Item>
);

// Backward-compatible single-item accordion.
type ConfiguratorAccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export const ConfiguratorAccordion = ({ title, children, defaultOpen = false }: ConfiguratorAccordionProps) => (
  <Accordion.Root type="single" collapsible defaultValue={defaultOpen ? "item-1" : undefined}>
    <Accordion.Item value="item-1">
      <Accordion.Trigger>{title}</Accordion.Trigger>
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
);
