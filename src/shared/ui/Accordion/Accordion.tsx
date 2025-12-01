import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import s from "./Accordion.module.scss";

type RootProps = AccordionPrimitive.AccordionSingleProps | AccordionPrimitive.AccordionMultipleProps;

const Root = ({ className, ...props }: RootProps) => (
  <AccordionPrimitive.Root {...props} className={clsx(s.Root, className)} />
);

const Item = ({ className, ...props }: AccordionPrimitive.AccordionItemProps) => (
  <AccordionPrimitive.Item {...props} className={clsx(s.Item, className)} />
);

const Trigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionPrimitive.AccordionTriggerProps
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className={s.Header}>
    <AccordionPrimitive.Trigger ref={ref} className={clsx(s.Trigger, className)} {...props}>
      <span>{children}</span>
      <ChevronDownIcon className={s.Chevron} aria-hidden />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));

const Content = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  AccordionPrimitive.AccordionContentProps
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className={clsx(s.Content, className)} {...props}>
    <div className={s.ContentText}>{children}</div>
  </AccordionPrimitive.Content>
));

export const Accordion = { Root, Item, Trigger, Content };
