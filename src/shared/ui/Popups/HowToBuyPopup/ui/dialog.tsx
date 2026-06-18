import { createContext, type HTMLAttributes, type PropsWithChildren, useContext } from "react";

import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";

type DialogContextValue = {
  onOpenChange: (open: boolean) => void;
};

type DialogProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

const DialogContext = createContext<DialogContextValue | null>(null);

const mergeClassName = (...classNames: Array<string | undefined>) => classNames.filter(Boolean).join(" ");

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null;

  return <DialogContext.Provider value={{ onOpenChange }}>{children}</DialogContext.Provider>;
};

const DialogPortal = ({ children }: PropsWithChildren) => <PortalBody>{children}</PortalBody>;

const DialogOverlay = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(DialogContext);

  return (
    <div
      className={mergeClassName("how-to-buy-dialog-overlay", className)}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        context?.onOpenChange(false);
      }}
    />
  );
};

const DialogContent = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(DialogContext);

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        role="dialog"
        aria-modal="true"
        className={mergeClassName("how-to-buy-dialog-content", className)}
        {...props}
      >
        {children}
        <button type="button" className="how-to-buy-dialog-close" onClick={() => context?.onOpenChange(false)}>
          <CloseBtnIcon />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  );
};

const DialogTrigger = ({ children }: PropsWithChildren) => <>{children}</>;
const DialogClose = ({ children }: PropsWithChildren) => <>{children}</>;
const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={mergeClassName("how-to-buy-dialog-header", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={mergeClassName("how-to-buy-dialog-footer", className)} {...props} />
);
const DialogTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={mergeClassName("how-to-buy-dialog-title", className)} {...props} />
);
const DialogDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={mergeClassName("how-to-buy-dialog-description", className)} {...props} />
);

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
