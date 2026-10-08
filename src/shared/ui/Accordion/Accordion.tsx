import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import ChevronDownIcon from "@/shared/assets/images/svg/chevron-down.svg?react";
import clsx from "clsx";
import s from "./Accordion.module.scss";

type RootProps = AccordionPrimitive.Root.Props<string>;

const Root = React.forwardRef<HTMLDivElement, RootProps>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root
    {...props}
    ref={ref}
    className={(state) => clsx(s.Root, typeof className === "function" ? className(state) : className)}
  />
));
Root.displayName = "Accordion.Root";

const Item = React.forwardRef<HTMLDivElement, AccordionPrimitive.Item.Props>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    {...props}
    ref={ref}
    className={(state) => clsx(s.Item, typeof className === "function" ? className(state) : className)}
  />
));
Item.displayName = "Accordion.Item";

const Trigger = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Trigger>, AccordionPrimitive.Trigger.Props>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Header className={s.Header}>
      <AccordionPrimitive.Trigger
        {...props}
        ref={ref}
        className={(state) => clsx(s.Trigger, typeof className === "function" ? className(state) : className)}
      >
        <span>{children}</span>
        <ChevronDownIcon className={s.Chevron} aria-hidden />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  ),
);
Trigger.displayName = "Accordion.Trigger";

const Content = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Panel>, AccordionPrimitive.Panel.Props>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Panel
      {...props}
      ref={ref}
      className={(state) => clsx(s.Content, typeof className === "function" ? className(state) : className)}
    >
      <div className={s.ContentText}>{children}</div>
    </AccordionPrimitive.Panel>
  ),
);
Content.displayName = "Accordion.Content";

export const Accordion = { Root, Item, Trigger, Content };
